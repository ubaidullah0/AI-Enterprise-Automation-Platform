import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { sendPasswordResetEmail, sendWelcomeEmail, sendOtpEmail } from '../services/email.service';

// ─── Token generation ─────────────────────────────────────────────────────────
const generateTokens = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET;
  
  if (!jwtSecret || !refreshSecret) {
    throw new Error('JWT_SECRET or REFRESH_TOKEN_SECRET is not configured on the server.');
  }

  const accessToken = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    refreshSecret,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, firstName, lastName } = validatedData;

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user — specific message
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'This email is already registered. Please sign in instead.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Get or create system role
    let defaultSysRole = await prisma.systemRole.findUnique({ where: { name: 'user' } });
    if (!defaultSysRole) {
      defaultSysRole = await prisma.systemRole.create({
        data: { name: 'user', permissions: ['read:own'] }
      });
    }

    // Get or create OWNER org role
    let ownerRole = await prisma.organizationRole.findUnique({ where: { name: 'OWNER' } });
    if (!ownerRole) {
      ownerRole = await prisma.organizationRole.create({
        data: { name: 'OWNER', permissions: ['*'] }
      });
    }

    const displayName = firstName || normalizedEmail.split('@')[0];

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: normalizedEmail, passwordHash, firstName, lastName, systemRoleId: defaultSysRole!.id }
      });
      const org = await tx.organization.create({
        data: { name: `${displayName}'s Workspace` }
      });
      await tx.organizationMember.create({
        data: { userId: newUser.id, organizationId: org.id, roleId: ownerRole!.id }
      });
      return tx.user.update({
        where: { id: newUser.id },
        data: { activeOrganizationId: org.id },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          systemRole: true, activeOrganizationId: true,
          memberships: { include: { organization: true, role: true } }
        }
      });
    });

    const tokens = generateTokens(result.id);

    // Send welcome email (non-fatal)
    sendWelcomeEmail(result.email, result.firstName).catch(() => {});

    // Trigger n8n webhook (non-fatal)
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/user-registration';
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: result }),
        signal: AbortSignal.timeout(2000)
      });
    } catch { /* n8n is optional */ }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user: result, ...tokens }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
        errors: error.errors
      });
    }
    // Prisma unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'This email is already registered. Please sign in instead.'
      });
    }
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        systemRole: true,
        memberships: { include: { organization: true, role: true } }
      }
    });

    // User not found — specific message
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'No account found with this email address.'
      });
    }

    // Password mismatch — specific message
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_PASSWORD',
        message: 'Incorrect password. Please try again.'
      });
    }

    const tokens = generateTokens(user.id);
    const { passwordHash, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, ...tokens }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
        errors: error.errors
      });
    }
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token is required.' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as { userId: string };
    const tokens = generateTokens(decoded.userId);
    return res.status(200).json({ success: true, data: tokens });
  } catch {
    return res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        systemRole: true, isEmailVerified: true, activeOrganizationId: true,
        memberships: { include: { organization: true, role: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Auto-create workspace for legacy users with no org
    if (user.memberships.length === 0) {
      let ownerRole = await prisma.organizationRole.findUnique({ where: { name: 'OWNER' } });
      if (!ownerRole) {
        ownerRole = await prisma.organizationRole.create({ data: { name: 'OWNER', permissions: ['*'] } });
      }
      const displayName = user.firstName || user.email.split('@')[0];
      await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: `${displayName}'s Workspace` } });
        await tx.organizationMember.create({ data: { userId, organizationId: org.id, roleId: ownerRole!.id } });
        await tx.user.update({ where: { id: userId }, data: { activeOrganizationId: org.id } });
      });
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          systemRole: true, isEmailVerified: true, activeOrganizationId: true,
          memberships: { include: { organization: true, role: true } }
        }
      });
    }

    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /api/v1/auth/active-org ─────────────────────────────────────────────
export const setActiveOrganization = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { organizationId } = req.body;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this organization' });
    }
    await prisma.user.update({ where: { id: userId }, data: { activeOrganizationId: organizationId } });
    return res.status(200).json({ success: true, message: 'Active organization updated' });
  } catch (error) {
    console.error('setActiveOrg error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
export const logout = async (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// ─── POST /api/v1/auth/forgot-password ────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response) => {
  const SAFE_RESPONSE = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent. Please check your inbox.'
  };

  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      // Invalidate existing tokens
      await (prisma as any).passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Generate new secure token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await (prisma as any).passwordResetToken.create({
        data: { token: resetToken, userId: user.id, expiresAt },
      });

      // Fire-and-forget email
      sendPasswordResetEmail(normalizedEmail, resetToken, user.firstName)
        .then((sent) => {
          if (!sent) console.warn(`[PasswordReset] Email failed for ${normalizedEmail}`);
          else console.info(`[PasswordReset] Email sent to ${normalizedEmail}`);
        })
        .catch((err) => console.error('[PasswordReset] Email error:', err));
    }

    return res.status(200).json(SAFE_RESPONSE);
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(200).json(SAFE_RESPONSE);
  }
};

// ─── POST /api/v1/auth/reset-password ─────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, code: 'MISSING_TOKEN', message: 'Reset token is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' });
    }

    const resetRecord = await (prisma as any).passwordResetToken.findUnique({ where: { token } });

    if (!resetRecord) {
      return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid reset token. Please request a new password reset.' });
    }
    if (resetRecord.used) {
      return res.status(400).json({ success: false, code: 'TOKEN_USED', message: 'This reset link has already been used. Please request a new one.' });
    }
    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ success: false, code: 'TOKEN_EXPIRED', message: 'This reset link has expired. Please request a new password reset.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetRecord.userId }, data: { passwordHash } }),
      (prisma as any).passwordResetToken.update({ where: { id: resetRecord.id }, data: { used: true } }),
    ]);

    console.info(`[PasswordReset] Password successfully reset for userId: ${resetRecord.userId}`);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/forgot-password-otp ────────────────────────────────────
export const forgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, code: 'MISSING_EMAIL', message: 'Email is required.' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists, a code has been sent.' });
    }

    // Rate-limit: max 3 OTPs per 15 minutes
    const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await (prisma as any).passwordResetOtp.count({
      where: { userId: user.id, createdAt: { gte: fifteenAgo } },
    });
    if (recentCount >= 3) {
      return res.status(429).json({
        success: false, code: 'RATE_LIMITED',
        message: 'Too many OTP requests. Please wait 15 minutes before trying again.',
      });
    }

    // Invalidate all previous unused OTPs
    await (prisma as any).passwordResetOtp.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate cryptographically secure 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min

    await (prisma as any).passwordResetOtp.create({
      data: { userId: user.id, email: normalizedEmail, otpHash, expiresAt },
    });

    sendOtpEmail(normalizedEmail, otp, user.firstName)
      .then((sent) => { 
        if (!sent) {
          console.warn(`[OTP-WARNING] SMTP not configured. The OTP for ${normalizedEmail} is: ${otp}`);
        } else {
          console.info(`[OTP] Sent to ${normalizedEmail}`); 
        }
      })
      .catch((err) => console.error('[OTP] email error:', err));

    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('forgotPasswordOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/verify-otp ─────────────────────────────────────────────
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Email and OTP are required.' });
    }
    const normalizedEmail = email.toLowerCase().trim();

    const record = await (prisma as any).passwordResetOtp.findFirst({
      where: { email: normalizedEmail, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({
        success: false, code: 'INVALID_OTP',
        message: 'Code is invalid or has expired. Please request a new one.',
      });
    }

    // Brute-force guard: max 5 failed attempts
    if (record.attempts >= 5) {
      await (prisma as any).passwordResetOtp.update({ where: { id: record.id }, data: { used: true } });
      return res.status(429).json({
        success: false, code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    const isValid = await bcrypt.compare(String(otp).trim(), record.otpHash);
    if (!isValid) {
      await (prisma as any).passwordResetOtp.update({
        where: { id: record.id }, data: { attempts: { increment: 1 } },
      });
      const remaining = 4 - record.attempts;
      return res.status(400).json({
        success: false, code: 'WRONG_OTP',
        message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    // OTP valid — issue short-lived reset token (15 min)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await (prisma as any).passwordResetOtp.update({
      where: { id: record.id }, data: { resetToken, resetTokenExpiry },
    });

    console.info(`[OTP] Verified for ${normalizedEmail}`);
    return res.status(200).json({ success: true, message: 'Code verified.', data: { resetToken } });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/auth/reset-password-otp ─────────────────────────────────────
export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || typeof resetToken !== 'string') {
      return res.status(400).json({ success: false, code: 'MISSING_TOKEN', message: 'Reset token is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' });
    }

    const record = await (prisma as any).passwordResetOtp.findFirst({
      where: { resetToken, used: false, resetTokenExpiry: { gt: new Date() } },
    });

    if (!record) {
      return res.status(400).json({
        success: false, code: 'INVALID_RESET_TOKEN',
        message: 'Session expired or invalid. Please restart the password reset.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      (prisma as any).passwordResetOtp.update({
        where: { id: record.id },
        data: { used: true, usedAt: new Date(), resetToken: null },
      }),
    ]);

    console.info(`[OTP] Password reset completed for userId: ${record.userId}`);
    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in.',
    });
  } catch (error) {
    console.error('resetPasswordWithOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
