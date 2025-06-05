import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';

@Injectable()
export class FriendNotificationHelper {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Send a friend request notification
   */
  async sendFriendRequestNotification(
    recipientUserId: string,
    senderUserId: string,
    message?: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.FRIEND_REQUEST,
      {
        senderUserId,
        message: message || 'Would you like to be friends?',
      },
    );
  }
} 