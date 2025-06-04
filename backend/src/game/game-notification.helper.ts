import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { GamePlayer } from './game-manager.service';

@Injectable()
export class GameNotificationHelper {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Send a game invite notification to a player
   */
  async sendGameInviteNotification(
    recipientUserId: string,
    senderUserId: string,
    matchId: string,
    timeFormat: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.GAME_INVITE,
      {
        senderUserId,
        matchId,
        timeFormat,
      },
    );
  }

  /**
   * Send a notification when a game invite is accepted
   */
  async sendGameInviteAcceptedNotification(
    recipientUserId: string,
    acceptorUserId: string,
    matchId: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      recipientUserId,
      NotificationType.GAME_INVITE_ACCEPTED,
      {
        senderUserId: acceptorUserId,
        matchId,
      },
    );
  }

  /**
   * Send a notification when a game is aborted due to timeout or disconnection
   */
  async sendGameAbortedNotification(
    player: GamePlayer,
    gameId: string,
    reason: string,
  ): Promise<void> {
    // Only send notifications to registered users (not guests)
    if (!player.userId) return;

    await this.notificationsService.sendNotification(
      player.userId,
      NotificationType.GAME_ABORTED,
      {
        gameId,
        reason,
      },
    );
  }
} 