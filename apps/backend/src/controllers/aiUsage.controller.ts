import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader } from '../utils/requestHelpers';

// ─── AI Usage Limits (configurable per plan) ──────────────────────────────────
const AI_USAGE_LIMITS = {
  daily: 200,    // max AI requests per org per day
  monthly: 3000, // max AI requests per org per month
};

// ─── GET /api/v1/ai/usage ─────────────────────────────────────────────────────
export const getAIUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayMessages, monthMessages, totalConversations] = await Promise.all([
      prisma.message.count({
        where: {
          conversation: { organizationId },
          role: 'user',
          createdAt: { gte: startOfDay }
        }
      }),
      prisma.message.count({
        where: {
          conversation: { organizationId },
          role: 'user',
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.conversation.count({ where: { organizationId } })
    ]);

    // Per-user breakdown for this month
    const userBreakdown = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: { organizationId },
        role: 'user',
        createdAt: { gte: startOfMonth }
      },
      _count: { id: true }
    });

    res.status(200).json({
      success: true,
      data: {
        usage: {
          today: { requests: todayMessages, limit: AI_USAGE_LIMITS.daily },
          month: { requests: monthMessages, limit: AI_USAGE_LIMITS.monthly },
          totalConversations,
        },
        limits: AI_USAGE_LIMITS,
        percentages: {
          daily: Math.min(Math.round((todayMessages / AI_USAGE_LIMITS.daily) * 100), 100),
          monthly: Math.min(Math.round((monthMessages / AI_USAGE_LIMITS.monthly) * 100), 100),
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Middleware to enforce AI rate limits before processing a chat request.
 * Can be applied to the /ai/chat route.
 */
export const checkAIRateLimit = async (req: Request, res: Response, next: Function) => {
  try {
    const orgId = req.headers['x-organization-id'] as string | undefined;
    if (!orgId) return next(); // No org → skip limit check

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await prisma.message.count({
      where: {
        conversation: { organizationId: orgId },
        role: 'user',
        createdAt: { gte: startOfDay }
      }
    });

    if (todayCount >= AI_USAGE_LIMITS.daily) {
      return res.status(429).json({
        success: false,
        message: `Daily AI request limit of ${AI_USAGE_LIMITS.daily} reached. Resets at midnight.`
      });
    }

    next();
  } catch {
    next(); // Non-fatal — allow request through if limit check fails
  }
};
