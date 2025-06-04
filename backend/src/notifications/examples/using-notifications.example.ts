import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * This is an example service that demonstrates how to use the NotificationsService
 * in other parts of your application.
 * 
 * NOTE: This is just an example and not meant to be used in production.
 */
@Injectable()
export class GameService {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Example: Sending a game invite notification
   */
  async sendGameInvite(
    fromUserId: string,
    toUserId: string,
    gameId: string,
    timeControl: string,
  ): Promise<void> {
    // Send a notification to the invited user
    await this.notificationsService.sendNotification(
      toUserId, // recipient
      NotificationType.GAME_INVITE, // notification type
      {
        senderUserId: fromUserId, // who sent the invite
        gameId, // game details
        timeControl,
        message: `${fromUserId} has invited you to a ${timeControl} game`,
      },
    );
    
    console.log(`Game invite notification sent to user ${toUserId}`);
  }

  /**
   * Example: Notifying users about game results
   */
  async notifyGameResult(
    gameId: string,
    whiteUserId: string,
    blackUserId: string,
    result: 'white' | 'black' | 'draw',
  ): Promise<void> {
    // Determine winner and loser
    const winner = result === 'white' ? whiteUserId : result === 'black' ? blackUserId : null;
    
    // Notify white player
    await this.notificationsService.sendNotification(
      whiteUserId,
      NotificationType.GAME_RESULT,
      {
        gameId,
        result,
        isWinner: result === 'white',
        isDraw: result === 'draw',
        opponentId: blackUserId,
        message: this.getResultMessage(result, 'white'),
      },
    );
    
    // Notify black player
    await this.notificationsService.sendNotification(
      blackUserId,
      NotificationType.GAME_RESULT,
      {
        gameId,
        result,
        isWinner: result === 'black',
        isDraw: result === 'draw',
        opponentId: whiteUserId,
        message: this.getResultMessage(result, 'black'),
      },
    );
    
    console.log(`Game result notifications sent for game ${gameId}`);
  }

  /**
   * Example: Sending a tournament reminder
   */
  async sendTournamentReminders(
    tournamentId: string,
    tournamentName: string,
    participantIds: string[],
    startTime: Date,
  ): Promise<void> {
    // Calculate time until tournament starts
    const now = new Date();
    const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / 60000);
    
    // Send a notification to each participant
    for (const userId of participantIds) {
      await this.notificationsService.sendNotification(
        userId,
        NotificationType.TOURNAMENT_ALERT,
        {
          tournamentId,
          tournamentName,
          startTime,
          message: `Tournament "${tournamentName}" starts in ${minutesUntilStart} minutes!`,
        },
      );
    }
    
    console.log(`Tournament reminders sent to ${participantIds.length} participants`);
  }

  /**
   * Helper method to generate result messages
   */
  private getResultMessage(result: 'white' | 'black' | 'draw', playerColor: 'white' | 'black'): string {
    if (result === 'draw') {
      return 'Your game ended in a draw';
    }
    
    if (
      (result === 'white' && playerColor === 'white') ||
      (result === 'black' && playerColor === 'black')
    ) {
      return 'Congratulations! You won the game';
    }
    
    return 'Game over. You lost the match';
  }
} 