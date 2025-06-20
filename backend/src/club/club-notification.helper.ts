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
    const promises = adminUserIds.map((adminId) =>
      this.notificationsService.sendNotification(
        adminId,
        NotificationType.CLUB_MEMBER_LEFT,
        {
          senderUserId: memberUserId,
          clubId,
          clubName,
          memberName: memberUsername,
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
    clubName: string
  ): Promise<void> {
    const message = `You are the new club member of this ${clubName}`;
    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.SUPER_ADMIN_TRANSFER,
      { senderUserId, clubName, message }
    );
  }

  /**
   * Notify a user when they are removed from a club by the super admin
   */
  async sendMemberRemovedNotification(
    removedUserId: string,
    clubId: string,
    clubName: string,
    removedByName: string,
    clubLogo: string
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      removedUserId,
      NotificationType.CLUB_MEMBER_REMOVED,
      {
        clubId,
        clubName,
        removedByName,
        clubLogo,
        message: `You have been removed from the club ${clubName} by ${removedByName}.`
      }
    );
  }
} 