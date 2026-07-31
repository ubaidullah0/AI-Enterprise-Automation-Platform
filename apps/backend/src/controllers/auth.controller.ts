import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, firstName, lastName } = validatedData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'User already exists with this email.' });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Get or create default system role
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

    // Create user + default personal org in a transaction
    const displayName = firstName || email.split('@')[0];
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const newUser = await tx.user.create({
        data: { email, passwordHash, firstName, lastName, systemRoleId: defaultSysRole!.id }
      });

      // 2. Create personal workspace org
      const org = await tx.organization.create({
        data: { name: `${displayName}'s Workspace` }
      });

      // 3. Add user as OWNER
      await tx.organizationMember.create({
        data: { userId: newUser.id, organizationId: org.id, roleId: ownerRole!.id }
      });

      // 4. Set active org
      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: { activeOrganizationId: org.id },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          systemRole: true, activeOrganizationId: true,
          memberships: { include: { organization: true, role: true } }
        }
      });

      return updatedUser;
    });

    const tokens = generateTokens(result.id);

    // Trigger n8n webhook (non-fatal)
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/user-registration';
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: result }),
      });
    } catch { /* n8n is optional */ }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user: result, ...tokens }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: 'Validation Error', errors: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        systemRole: true,
        memberships: {
          include: {
            organization: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const tokens = generateTokens(user.id);

    const { passwordHash, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: 'Validation Error', errors: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ success: false, message: 'Refresh token is required.' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as { userId: string };
    const tokens = generateTokens(decoded.userId);

    res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        systemRole: true,
        isEmailVerified: true,
        activeOrganizationId: true,
        memberships: {
          include: {
            organization: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // ── Auto-create personal workspace for legacy users with no org ──────────
    if (user.memberships.length === 0) {
      let ownerRole = await prisma.organizationRole.findUnique({ where: { name: 'OWNER' } });
      if (!ownerRole) {
        ownerRole = await prisma.organizationRole.create({
          data: { name: 'OWNER', permissions: ['*'] }
        });
      }
      const displayName = user.firstName || user.email.split('@')[0];
      await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: `${displayName}'s Workspace` }
        });
        await tx.organizationMember.create({
          data: { userId, organizationId: org.id, roleId: ownerRole!.id }
        });
        await tx.user.update({
          where: { id: userId },
          data: { activeOrganizationId: org.id }
        });
      });

      // Re-fetch user with fresh org data
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          systemRole: true,
          isEmailVerified: true,
          activeOrganizationId: true,
          memberships: {
            include: { organization: true, role: true }
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


export const setActiveOrganization = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { organizationId } = req.body;

    // Verify user is a member of the organization
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this organization' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: organizationId }
    });

    res.status(200).json({ success: true, message: 'Active organization updated' });
  } catch (error) {
    console.error('setActiveOrg error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Since we use JWTs without a database blacklist for now, the client simply discards the token.
  // In a robust system we'd blacklist the token.
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};
