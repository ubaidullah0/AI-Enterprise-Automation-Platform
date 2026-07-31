import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(50),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']), // Can't invite as OWNER
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10, 'Invalid token'),
});

export const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
});
