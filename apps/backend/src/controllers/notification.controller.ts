import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader } from '../utils/requestHelpers';

// ─── GET /api/v1/notifications ───────────────────────────────────────────────
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const notifications = await prisma.notification.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }]  // org-wide + personal
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ success: true, data: { notifications, unreadCount } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /api/v1/notifications/mark-read ─────────────────────────────────────
export const markAllRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    await prisma.notification.updateMany({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }],
        isRead: false
      },
      data: { isRead: true }
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/notifications (Internal helper - also exported for use in other controllers)
export const createNotification = async (
  organizationId: string,
  userId: string | null,
  type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING',
  title: string,
  message: string
) => {
  try {
    return await prisma.notification.create({
      data: { organizationId, userId, type, title, message }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
