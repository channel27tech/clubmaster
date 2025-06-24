import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';

@Injectable()
export class ClubNotificationHelper {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Notify club admins when a new member joins the club
   */
  async sendMemberJoinedNotification(
    adminUserIds: string[],
    memberUserId: string,
    memberUsername: string,
    clubId: string,
    clubName: string,
  ): Promise<void> {
    const promises = adminUserIds.map((adminId) =>
      this.notificationsService.sendNotification(
        adminId,
        NotificationType.CLUB_MEMBER_JOINED,
        {
          senderUserId: memberUserId,
          clubId,
          clubName,
          memberUsername,
        },
      ),
    );

    await Promise.all(promises);
  }

  /**
   * Notify club admins when a member leaves the club
   */
  async sendMemberLeftNotification(
    adminUserIds: string[],
    memberUserId: string,
    memberUsername: string,
    clubId: string,
    clubName: string,
    memberAvatar: string,
  ): Promise<void> {
    const message = `${memberUsername} has left your club ${clubName}.`;
    const promises = adminUserIds.map((adminId) =>
      this.notificationsService.sendNotification(
        adminId,
        NotificationType.CLUB_MEMBER_LEFT,
        {
          message,
          senderUserId: memberUserId,
          clubId,
          clubName,
          memberUsername,
          memberAvatar,
        },
      ),
    );
    await Promise.all(promises);
  }

  /**
   * Notify a user when their role in a club is updated
   */
  async sendRoleUpdateNotification(
    userId: string,
    updatedByUserId: string,
    clubId: string,
    clubName: string,
    newRole: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      userId,
      NotificationType.CLUB_ROLE_UPDATE,
      {
        senderUserId: updatedByUserId,
        clubId,
        clubName,
        newRole,
      },
    );
  }

  /**
   * Send a notification for super admin transfer events (request/accept/decline)
   */
  async sendSuperAdminTransferNotification(
    recipientUserId: string,
    senderUserId: string,
    clubName: string,
    clubLogo: string,
  ): Promise<void> {
    const message = `You are the new super admin of the club ${clubName}`;
    const payload = { senderUserId, clubName, message, clubLogo };
    console.log('[ClubNotificationHelper] Payload to be sent:', payload);

    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.SUPER_ADMIN_TRANSFER,
      payload,
    );
  }

  /**
   * Notify a member when they have been removed from a club
   */
  async sendMemberRemovedNotification(
    recipientUserId: string,
    clubId: string,
    clubName: string,
    removedByUserId: string,
    removedByName: string,
    clubLogo: string,
  ): Promise<void> {
    const message = `You have been removed from the club ${clubName} by ${removedByName}.`;
    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.CLUB_MEMBER_REMOVED,
      {
        message,
        clubId,
        clubName,
        removedByUserId,
        removedByName,
        clubLogo,
      },
    );
  }
} 