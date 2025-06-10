import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';

@Injectable()
export class TournamentNotificationHelper {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Send a tournament reminder notification
   */
  async sendTournamentReminderNotification(
    participantUserId: string,
    tournamentId: string,
    tournamentName: string,
    matchTime: Date,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      participantUserId,
      NotificationType.TOURNAMENT_REMINDER,
      {
        tournamentId,
        tournamentName,
        matchTime: matchTime.toISOString(),
        message: `Your tournament match in ${tournamentName} starts soon.`,
      },
    );
  }

  /**
   * Send a tournament alert notification
   */
  async sendTournamentAlertNotification(
    participantUserId: string,
    tournamentId: string,
    tournamentName: string,
    message: string,
  ): Promise<void> {
    await this.notificationsService.sendNotification(
      participantUserId,
      NotificationType.TOURNAMENT_ALERT,
      {
        tournamentId,
        tournamentName,
        message,
      },
    );
  }
} 