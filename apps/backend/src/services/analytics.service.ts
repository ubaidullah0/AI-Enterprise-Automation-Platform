/**
 * analytics.service.ts
 *
 * All analytics query logic lives here — controller stays thin.
 *
 * Design notes:
 * - All queries are org-scoped (organizationId always required)
 * - Flexible date range via `days` parameter (7, 30, 90, 365)
 * - Cost estimates are clearly marked as approximate
 * - Heavy queries use Promise.all for parallelism
 * - No mutations — read-only service
 */

import { prisma } from '../utils/prisma';

// ── Cost rate table (USD per 1M tokens) ──────────────────────────────────────
// Source: public pricing pages as of 2026. These are ESTIMATES only.
export const COST_RATES: Record<string, { input: number; output: number }> = {
  'openai':             { input: 2.50,  output: 10.00 }, // gpt-4o default
  'gpt-4o':             { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':        { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':      { input: 0.50,  output: 1.50  },
  'gemini':             { input: 0.075, output: 0.30  }, // gemini-2.0-flash
  'gemini-2.0-flash':   { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':     { input: 3.50,  output: 10.50 },
  'anthropic':          { input: 3.00,  output: 15.00 }, // claude-3.5-sonnet
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022':  { input: 0.80, output: 4.00  },
  'azure-openai':       { input: 2.50,  output: 10.00 },
};

/**
 * Estimate cost from token count.
 * Assumes 70/30 split between prompt/completion tokens.
 */
export function estimateCost(provider: string, model: string | null, totalTokens: number): number {
  const key = model ?? provider;
  const rates = COST_RATES[key] ?? COST_RATES[provider] ?? { input: 2.50, output: 10.00 };
  const inputTokens = Math.floor(totalTokens * 0.7);
  const outputTokens = totalTokens - inputTokens;
  return ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1_000_000;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Overview KPIs ─────────────────────────────────────────────────────────────

export interface OverviewData {
  conversations: { total: number; thisMonth: number };
  messages:      { total: number; thisMonth: number; avgPerConversation: number };
  workflows:     { total: number; active: number };
  workflowRuns:  { total: number; thisMonth: number };
  members:       number;
  tokens:        { thisMonth: number; allTime: number };
  estimatedCostUsd: { thisMonth: number; allTime: number; isEstimate: true };
  avgLatencyMs:  number | null;
}

export async function getOverview(organizationId: string): Promise<OverviewData> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalConversations,
    monthConversations,
    totalMessages,
    monthMessages,
    totalWorkflows,
    activeWorkflows,
    totalRuns,
    monthRuns,
    memberCount,
    tokenAgg,
    monthTokenAgg,
    latencyAgg,
  ] = await Promise.all([
    prisma.conversation.count({ where: { organizationId } }),
    prisma.conversation.count({ where: { organizationId, createdAt: { gte: startOfMonth } } }),
    prisma.message.count({ where: { conversation: { organizationId } } }),
    prisma.message.count({ where: { conversation: { organizationId }, createdAt: { gte: startOfMonth } } }),
    prisma.workflow.count({ where: { organizationId } }),
    prisma.workflow.count({ where: { organizationId, isActive: true } }),
    prisma.workflowRun.count({ where: { workflow: { organizationId } } }),
    prisma.workflowRun.count({ where: { workflow: { organizationId }, startedAt: { gte: startOfMonth } } }),
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.message.aggregate({
      where: { conversation: { organizationId }, role: 'assistant', tokens: { not: null } },
      _sum: { tokens: true, costUsd: true },
    }),
    prisma.message.aggregate({
      where: { conversation: { organizationId }, role: 'assistant', tokens: { not: null }, createdAt: { gte: startOfMonth } },
      _sum: { tokens: true, costUsd: true },
    }),
    prisma.message.aggregate({
      where: { conversation: { organizationId }, role: 'assistant', latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
  ]);

  const avgPerConversation = totalConversations > 0
    ? Math.round(totalMessages / totalConversations)
    : 0;

  return {
    conversations: { total: totalConversations, thisMonth: monthConversations },
    messages: { total: totalMessages, thisMonth: monthMessages, avgPerConversation },
    workflows: { total: totalWorkflows, active: activeWorkflows },
    workflowRuns: { total: totalRuns, thisMonth: monthRuns },
    members: memberCount,
    tokens: {
      allTime: tokenAgg._sum.tokens ?? 0,
      thisMonth: monthTokenAgg._sum.tokens ?? 0,
    },
    estimatedCostUsd: {
      allTime: Math.round((tokenAgg._sum.costUsd ?? 0) * 10000) / 10000,
      thisMonth: Math.round((monthTokenAgg._sum.costUsd ?? 0) * 10000) / 10000,
      isEstimate: true,
    },
    avgLatencyMs: latencyAgg._avg.latencyMs
      ? Math.round(latencyAgg._avg.latencyMs)
      : null,
  };
}

// ── AI Usage Time Series ──────────────────────────────────────────────────────

export interface UsagePoint {
  date: string;         // "2026-07-01"
  messages: number;
  tokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number | null;
}

export async function getAIUsageSeries(organizationId: string, days: number): Promise<UsagePoint[]> {
  const since = daysAgo(days);

  const messages = await prisma.message.findMany({
    where: {
      conversation: { organizationId },
      role: 'assistant',
      createdAt: { gte: since },
    },
    select: { createdAt: true, tokens: true, costUsd: true, latencyMs: true },
    orderBy: { createdAt: 'asc' },
  });

  // Build date buckets
  const buckets: Record<string, { messages: number; tokens: number; cost: number; latencies: number[] }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { messages: 0, tokens: 0, cost: 0, latencies: [] };
  }

  for (const m of messages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (buckets[key]) {
      buckets[key].messages++;
      buckets[key].tokens += m.tokens ?? 0;
      buckets[key].cost += m.costUsd ?? 0;
      if (m.latencyMs != null) buckets[key].latencies.push(m.latencyMs);
    }
  }

  return Object.entries(buckets).map(([date, b]) => ({
    date,
    messages: b.messages,
    tokens: b.tokens,
    estimatedCostUsd: Math.round(b.cost * 10000) / 10000,
    avgLatencyMs: b.latencies.length > 0
      ? Math.round(b.latencies.reduce((a, c) => a + c, 0) / b.latencies.length)
      : null,
  }));
}

// ── Workflow Stats ────────────────────────────────────────────────────────────

export interface WorkflowStats {
  total: number;
  active: number;
  runsTotal: number;
  byStatus: { COMPLETED: number; FAILED: number; RUNNING: number; PENDING: number };
  avgDurationMs: number | null;
  successRate: number | null;
}

export async function getWorkflowStats(organizationId: string): Promise<WorkflowStats> {
  const [total, active, runs, avgDur] = await Promise.all([
    prisma.workflow.count({ where: { organizationId } }),
    prisma.workflow.count({ where: { organizationId, isActive: true } }),
    prisma.workflowRun.groupBy({
      by: ['status'],
      where: { workflow: { organizationId } },
      _count: { id: true },
    }),
    prisma.workflowRun.aggregate({
      where: { workflow: { organizationId }, durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
  ]);

  const byStatus = { COMPLETED: 0, FAILED: 0, RUNNING: 0, PENDING: 0 };
  let runsTotal = 0;
  for (const r of runs) {
    const s = r.status as keyof typeof byStatus;
    byStatus[s] = r._count.id;
    runsTotal += r._count.id;
  }

  const successRate = runsTotal > 0
    ? Math.round((byStatus.COMPLETED / runsTotal) * 100)
    : null;

  return {
    total,
    active,
    runsTotal,
    byStatus,
    avgDurationMs: avgDur._avg.durationMs ? Math.round(avgDur._avg.durationMs) : null,
    successRate,
  };
}

// ── Top Users (OWNER/ADMIN/MANAGER only) ──────────────────────────────────────

export interface TopUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  messageCount: number;
  tokenCount: number;
  estimatedCostUsd: number;
  lastActiveAt: Date | null;
}

export async function getTopUsers(organizationId: string, limit: number): Promise<TopUser[]> {
  // Aggregate message counts per userId via conversations
  const conversations = await prisma.conversation.findMany({
    where: { organizationId },
    select: {
      userId: true,
      messages: {
        where: { role: 'assistant' },
        select: { tokens: true, costUsd: true, createdAt: true },
      },
    },
  });

  // Aggregate per user
  const userMap: Record<string, { messageCount: number; tokenCount: number; costUsd: number; lastActive: Date | null }> = {};
  for (const conv of conversations) {
    const uid = conv.userId;
    if (!userMap[uid]) userMap[uid] = { messageCount: 0, tokenCount: 0, costUsd: 0, lastActive: null };
    for (const msg of conv.messages) {
      userMap[uid].messageCount++;
      userMap[uid].tokenCount += msg.tokens ?? 0;
      userMap[uid].costUsd += msg.costUsd ?? 0;
      if (!userMap[uid].lastActive || msg.createdAt > userMap[uid].lastActive!) {
        userMap[uid].lastActive = msg.createdAt;
      }
    }
  }

  const sorted = Object.entries(userMap)
    .sort((a, b) => b[1].messageCount - a[1].messageCount)
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const userIndex = Object.fromEntries(users.map(u => [u.id, u]));

  return sorted.map(([uid, stats]) => ({
    userId: uid,
    email: userIndex[uid]?.email ?? 'Unknown',
    firstName: userIndex[uid]?.firstName ?? null,
    lastName: userIndex[uid]?.lastName ?? null,
    messageCount: stats.messageCount,
    tokenCount: stats.tokenCount,
    estimatedCostUsd: Math.round(stats.costUsd * 10000) / 10000,
    lastActiveAt: stats.lastActive,
  }));
}

// ── Provider Breakdown ────────────────────────────────────────────────────────

export interface ProviderBreakdown {
  provider: string;
  conversationCount: number;
  messageCount: number;
  tokenCount: number;
  estimatedCostUsd: number;
  avgLatencyMs: number | null;
}

export async function getProviderBreakdown(organizationId: string): Promise<ProviderBreakdown[]> {
  const conversations = await prisma.conversation.findMany({
    where: { organizationId },
    select: {
      provider: true,
      messages: {
        where: { role: 'assistant' },
        select: { tokens: true, costUsd: true, latencyMs: true },
      },
    },
  });

  const provMap: Record<string, { convs: number; msgs: number; tokens: number; cost: number; latencies: number[] }> = {};
  for (const conv of conversations) {
    const p = conv.provider || 'openai';
    if (!provMap[p]) provMap[p] = { convs: 0, msgs: 0, tokens: 0, cost: 0, latencies: [] };
    provMap[p].convs++;
    for (const msg of conv.messages) {
      provMap[p].msgs++;
      provMap[p].tokens += msg.tokens ?? 0;
      provMap[p].cost += msg.costUsd ?? 0;
      if (msg.latencyMs != null) provMap[p].latencies.push(msg.latencyMs);
    }
  }

  return Object.entries(provMap).map(([provider, s]) => ({
    provider,
    conversationCount: s.convs,
    messageCount: s.msgs,
    tokenCount: s.tokens,
    estimatedCostUsd: Math.round(s.cost * 10000) / 10000,
    avgLatencyMs: s.latencies.length > 0
      ? Math.round(s.latencies.reduce((a, c) => a + c, 0) / s.latencies.length)
      : null,
  })).sort((a, b) => b.messageCount - a.messageCount);
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export interface ExportRow {
  date: string;
  event: string;
  user: string;
  resource: string;
  details: string;
}

export async function getAuditExportRows(
  organizationId: string,
  days: number
): Promise<ExportRow[]> {
  const since = daysAgo(days);
  const logs = await prisma.auditLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
    take: 5000, // cap export size
  });

  return logs.map(l => ({
    date: l.createdAt.toISOString(),
    event: l.action,
    user: l.user ? `${l.user.firstName ?? ''} ${l.user.lastName ?? ''} <${l.user.email}>`.trim() : 'System',
    resource: l.resource,
    details: JSON.stringify(l.newData ?? l.oldData ?? {}),
  }));
}

export function rowsToCsv(rows: ExportRow[]): string {
  const header = 'Date,Event,User,Resource,Details\n';
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const body = rows.map(r =>
    [escape(r.date), escape(r.event), escape(r.user), escape(r.resource), escape(r.details)].join(',')
  ).join('\n');
  return header + body;
}
