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
  ): Promise<void> {
    const promises = adminUserIds.map((adminId) =>
      this.notificationsService.sendNotification(
        adminId,
        NotificationType.CLUB_MEMBER_LEFT,
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
   * Notify a user when they are made super admin of a club
   */
  async sendSuperAdminTransferNotification(
    userId: string,
    previousAdminId: string,
    clubId: string,
    clubName: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      userId,
      NotificationType.SUPER_ADMIN_TRANSFER,
      {
        senderUserId: previousAdminId,
        clubId,
        clubName,
      },
    );
  }
} 