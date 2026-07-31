/**
 * org-api-keys.service.ts
 *
 * Business logic for OrganizationApiKey management.
 * All business rules live here — controllers remain thin.
 *
 * Provider key resolution order:
 *   1. Org's ACTIVE default key for the provider
 *   2. Org's most-recent ACTIVE key for the provider
 *   3. Return null → caller falls back to process.env
 */

import { prisma } from '../utils/prisma';
import { encrypt, decrypt, buildKeyHint } from './encryption.service';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SupportedProvider } from '../schemas/org-api-keys.schema';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrgApiKeySafeView {
  id: string;
  organizationId: string;
  provider: string;
  model: string | null;
  label: string;
  keyHint: string;
  status: string;
  isDefault: boolean;
  lastUsedAt: Date | null;
  lastValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  latencyMs?: number;
}

// ── Key Resolution (used by AI controller) ───────────────────────────────────

/**
 * Resolves the decrypted API key for a given org + provider.
 * Returns null if no org key is stored → caller should fall back to .env.
 *
 * Lookup order:
 *   1. isDefault=true, status=ACTIVE
 *   2. Most recently created, status=ACTIVE
 */
export async function resolveOrgKey(
  organizationId: string,
  provider: string
): Promise<string | null> {
  const key = await prisma.organizationApiKey.findFirst({
    where: { organizationId, provider, status: 'ACTIVE' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  if (!key) return null;

  try {
    return decrypt(key.encryptedKey);
  } catch {
    // If decryption fails (corrupt data), treat as no key
    return null;
  }
}

/**
 * Non-blocking update of lastUsedAt for the active key.
 */
export async function touchLastUsed(
  organizationId: string,
  provider: string
): Promise<void> {
  const key = await prisma.organizationApiKey.findFirst({
    where: { organizationId, provider, status: 'ACTIVE' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });

  if (key) {
    await prisma.organizationApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
  }
}

// ── CRUD operations ──────────────────────────────────────────────────────────

/**
 * List all org API keys — NEVER returns encryptedKey.
 */
export async function listKeys(organizationId: string): Promise<OrgApiKeySafeView[]> {
  const keys = await prisma.organizationApiKey.findMany({
    where: { organizationId },
    orderBy: [{ provider: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Strip encryptedKey — return safe view only
  return keys.map(({ encryptedKey: _enc, ...safe }) => safe as OrgApiKeySafeView);
}

/**
 * Create a new org API key.
 * - Validates the key against the provider API before saving.
 * - Encrypts key before persisting.
 * - If isDefault=true, clears other defaults for same provider.
 * Returns the safe view (no plaintext key).
 */
export async function createKey(
  organizationId: string,
  userId: string,
  input: {
    provider: SupportedProvider;
    label: string;
    apiKey: string;
    model?: string;
    isDefault: boolean;
  }
): Promise<{ key: OrgApiKeySafeView; validation: ValidationResult }> {
  // 1. Validate against provider API first
  const validation = await validateKeyWithProvider(input.provider, input.apiKey);
  const status = validation.valid ? 'ACTIVE' : 'INVALID';

  // 2. Encrypt the key
  const encryptedKey = encrypt(input.apiKey);
  const keyHint = buildKeyHint(input.apiKey);

  // 3. If isDefault, unset other defaults for same provider in transaction
  const saved = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.organizationApiKey.updateMany({
        where: { organizationId, provider: input.provider, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.organizationApiKey.create({
      data: {
        organizationId,
        provider: input.provider,
        model: input.model ?? null,
        label: input.label,
        encryptedKey,
        keyHint,
        status,
        isDefault: input.isDefault,
        createdBy: userId,
        lastValidatedAt: new Date(),
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return created;
  });

  const { encryptedKey: _enc, ...safeView } = saved;
  return { key: safeView as OrgApiKeySafeView, validation };
}

/**
 * Update label, model, isDefault, or status of an existing key.
 * Does NOT update the key value itself (must delete + recreate for rotation).
 */
export async function updateKey(
  id: string,
  organizationId: string,
  input: {
    label?: string;
    model?: string;
    isDefault?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
  }
): Promise<OrgApiKeySafeView> {
  // Verify ownership
  const existing = await prisma.organizationApiKey.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw Object.assign(new Error('API key not found'), { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.organizationApiKey.updateMany({
        where: { organizationId, provider: existing.provider, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return tx.organizationApiKey.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.model !== undefined && { model: input.model }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.status !== undefined && { status: input.status }),
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  });

  const { encryptedKey: _enc, ...safeView } = updated;
  return safeView as OrgApiKeySafeView;
}

/**
 * Delete an org API key by id.
 * Returns the deleted key's safe metadata for audit logging.
 */
export async function deleteKey(
  id: string,
  organizationId: string
): Promise<{ provider: string; label: string; keyHint: string }> {
  const existing = await prisma.organizationApiKey.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw Object.assign(new Error('API key not found'), { status: 404 });
  }

  await prisma.organizationApiKey.delete({ where: { id } });

  return { provider: existing.provider, label: existing.label, keyHint: existing.keyHint };
}

/**
 * Set a specific key as the default for its provider.
 */
export async function setDefaultKey(
  id: string,
  organizationId: string
): Promise<OrgApiKeySafeView> {
  const existing = await prisma.organizationApiKey.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw Object.assign(new Error('API key not found'), { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.organizationApiKey.updateMany({
      where: { organizationId, provider: existing.provider, isDefault: true },
      data: { isDefault: false },
    });
    return tx.organizationApiKey.update({
      where: { id },
      data: { isDefault: true },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  });

  const { encryptedKey: _enc, ...safeView } = updated;
  return safeView as OrgApiKeySafeView;
}

/**
 * Validate a stored key by decrypting and calling the provider API.
 * Updates lastValidatedAt and status in DB.
 */
export async function validateStoredKey(
  id: string,
  organizationId: string
): Promise<ValidationResult> {
  const existing = await prisma.organizationApiKey.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw Object.assign(new Error('API key not found'), { status: 404 });
  }

  let plainKey: string;
  try {
    plainKey = decrypt(existing.encryptedKey);
  } catch {
    await prisma.organizationApiKey.update({
      where: { id },
      data: { status: 'INVALID', lastValidatedAt: new Date() },
    });
    return { valid: false, message: 'Decryption failed — key data may be corrupted' };
  }

  const result = await validateKeyWithProvider(existing.provider as SupportedProvider, plainKey);

  await prisma.organizationApiKey.update({
    where: { id },
    data: {
      status: result.valid ? 'ACTIVE' : 'INVALID',
      lastValidatedAt: new Date(),
    },
  });

  return result;
}

// ── Provider validation helpers ───────────────────────────────────────────────

/**
 * Validates an API key against the live provider API.
 * Uses the cheapest available call (list models) — no tokens consumed.
 */
async function validateKeyWithProvider(
  provider: SupportedProvider,
  apiKey: string
): Promise<ValidationResult> {
  const start = Date.now();
  try {
    switch (provider) {
      case 'openai':
        return await validateOpenAI(apiKey, start);
      case 'gemini':
        return await validateGemini(apiKey, start);
      case 'anthropic':
        return await validateAnthropic(apiKey, start);
      case 'azure-openai':
        // Azure requires endpoint — just check key format for now
        return validateAzureFormat(apiKey, start);
      default:
        return { valid: false, message: `Unknown provider: ${provider}` };
    }
  } catch (err: any) {
    return { valid: false, message: err?.message || 'Validation request failed' };
  }
}

async function validateOpenAI(apiKey: string, start: number): Promise<ValidationResult> {
  if (!apiKey.startsWith('sk-')) {
    return { valid: false, message: 'OpenAI keys must start with "sk-"' };
  }
  const client = new OpenAI({ apiKey });
  // list models is free and verifies auth
  await client.models.list();
  return { valid: true, message: 'OpenAI key is valid', latencyMs: Date.now() - start };
}

async function validateGemini(apiKey: string, start: number): Promise<ValidationResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Use a minimal generateContent call to verify the key
  // gemini-2.0-flash is low cost; we send a 1-token prompt
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  await model.generateContent('hi');
  return { valid: true, message: 'Gemini key is valid', latencyMs: Date.now() - start };
}

async function validateAnthropic(apiKey: string, start: number): Promise<ValidationResult> {
  if (!apiKey.startsWith('sk-ant-')) {
    return { valid: false, message: 'Anthropic keys must start with "sk-ant-"' };
  }
  const res = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, any>;
    return { valid: false, message: body['error']?.message || `HTTP ${res.status}` };
  }
  return { valid: true, message: 'Anthropic key is valid', latencyMs: Date.now() - start };
}

function validateAzureFormat(apiKey: string, start: number): ValidationResult {
  if (apiKey.length < 20) {
    return { valid: false, message: 'Azure OpenAI key appears too short. Keys are typically 32 characters.' };
  }
  return {
    valid: true,
    message: 'Azure OpenAI key format accepted. Note: full validation requires an endpoint URL.',
    latencyMs: Date.now() - start,
  };
}
