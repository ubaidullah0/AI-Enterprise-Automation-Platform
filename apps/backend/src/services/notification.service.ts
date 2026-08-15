import { prisma } from '../utils/prisma';

export class NotificationService {
  /**
   * Notify a specific user within an organization.
   */
  async notifyUser(
    userId: string,
    organizationId: string,
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING',
    title: string,
    message: string
  ) {
    return prisma.notification.create({
      data: {
        userId,
        organizationId,
        type,
        title,
        message,
      }
    });
  }

  /**
   * Notify all members of an organization.
   */
  async notifyOrganization(
    organizationId: string,
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING',
    title: string,
    message: string
  ) {
    return prisma.notification.create({
      data: {
        userId: null, // null userId means org-wide
        organizationId,
        type,
        title,
        message,
      }
    });
  }
}

export const notificationService = new NotificationService();
