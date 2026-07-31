/**
 * org-api-keys.schema.ts
 * Zod v4 validation schemas for OrganizationApiKey endpoints.
 */

import { z } from 'zod';

// Supported AI providers
export const SUPPORTED_PROVIDERS = ['openai', 'gemini', 'anthropic', 'azure-openai'] as const;
export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

// Default models per provider (used as UI hints)
export const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  'openai': 'gpt-4o',
  'gemini': 'gemini-2.0-flash',
  'anthropic': 'claude-3-5-sonnet-20241022',
  'azure-openai': 'gpt-4o',
};

// ── Create / Upsert ──────────────────────────────────────────────────────────
export const createOrgApiKeySchema = z.object({
  provider: z.union([
    z.literal('openai'),
    z.literal('gemini'),
    z.literal('anthropic'),
    z.literal('azure-openai'),
  ]),
  label: z
    .string()
    .min(2, 'Label must be at least 2 characters')
    .max(80, 'Label must be at most 80 characters')
    .trim(),
  apiKey: z
    .string()
    .min(10, 'API key is too short')
    .max(512, 'API key is too long')
    .trim(),
  model: z.string().min(1).max(100).trim().optional(),
  isDefault: z.boolean().optional().default(false),
});

// ── Update ───────────────────────────────────────────────────────────────────
export const updateOrgApiKeySchema = z.object({
  label: z.string().min(2).max(80).trim().optional(),
  model: z.string().min(1).max(100).trim().optional(),
  isDefault: z.boolean().optional(),
  status: z.union([z.literal('ACTIVE'), z.literal('INACTIVE')]).optional(),
});

export type CreateOrgApiKeyInput = z.infer<typeof createOrgApiKeySchema>;
export type UpdateOrgApiKeyInput = z.infer<typeof updateOrgApiKeySchema>;
