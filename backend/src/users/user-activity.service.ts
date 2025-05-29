import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

// Types for user activity status
export enum UserActivityStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
  IN_GAME = 'in-game',
}

// User activity data structure
export interface UserActivity {
  userId: string;
  socketId: string;
  status: UserActivityStatus;
  lastActive: Date;
  inGameId?: string;
}

@Injectable()
export class UserActivityService {
  private readonly logger = new Logger(UserActivityService.name);
  private readonly userActivities: Map<string, UserActivity> = new Map();
  // Socket ID to user ID mapping for quick lookups
  private readonly socketToUserId: Map<string, string> = new Map();
  // Timeout references for managing away status
  private readonly awayTimeouts: Map<string, NodeJS.Timeout> = new Map();
  // Time in milliseconds to consider a user as away (5 minutes)
  private readonly awayTimeThreshold = 5 * 60 * 1000;

  /**
   * Updates a user's activity status
   */
  updateUserActivity(
    userId: string,
    socketId: string,
    status: UserActivityStatus,
    inGameId?: string,
  ): UserActivity {
    // Clear any existing away timeout for this user
    this.clearAwayTimeout(userId);

    const userActivity: UserActivity = {
      userId,
      socketId,
      status,
      lastActive: new Date(),
      inGameId,
    };

    this.userActivities.set(userId, userActivity);
    this.socketToUserId.set(socketId, userId);

    // If the user is online, set a timeout to mark them as away after inactivity
    if (status === UserActivityStatus.ONLINE) {
      this.setAwayTimeout(userId);
    }

    this.logger.debug(
      `User ${userId} activity updated: ${status}${
        inGameId ? ` (Game: ${inGameId})` : ''
      }`,
    );

    return userActivity;
  }

  /**
   * Registers a user connection
   */
  registerConnection(userId: string, socketId: string): UserActivity {
    return this.updateUserActivity(userId, socketId, UserActivityStatus.ONLINE);
  }

  /**
   * Registers a user disconnection
   */
  registerDisconnection(socketId: string): void {
    const userId = this.socketToUserId.get(socketId);
    if (userId) {
      this.updateUserActivity(userId, socketId, UserActivityStatus.OFFLINE);
      this.clearAwayTimeout(userId);
      
      // Clean up mappings after a grace period (allow for reconnection)
      setTimeout(() => {
        // Only remove if still offline with same socket ID
        const activity = this.userActivities.get(userId);
        if (activity && activity.socketId === socketId && activity.status === UserActivityStatus.OFFLINE) {
          this.userActivities.delete(userId);
          this.socketToUserId.delete(socketId);
          this.logger.debug(`User ${userId} activity data cleaned up after disconnect`);
        }
      }, 30 * 60 * 1000); // 30 minutes
    }
  }

  /**
   * Registers a user joining a game
   */
  registerInGame(userId: string, gameId: string): void {
    const activity = this.userActivities.get(userId);
    if (activity) {
      this.updateUserActivity(
        userId,
        activity.socketId,
        UserActivityStatus.IN_GAME,
        gameId,
      );
    }
  }

  /**
   * Registers a user leaving a game
   */
  registerLeftGame(userId: string): void {
    const activity = this.userActivities.get(userId);
    if (activity) {
      this.updateUserActivity(
        userId,
        activity.socketId,
        UserActivityStatus.ONLINE,
      );
    }
  }

  /**
   * Registers user activity (to reset away timer)
   */
  registerActivity(userId: string): void {
    const activity = this.userActivities.get(userId);
    if (activity && activity.status !== UserActivityStatus.OFFLINE) {
      // Only update lastActive, don't change status if in game
      const currentStatus = activity.status === UserActivityStatus.AWAY
        ? UserActivityStatus.ONLINE
        : activity.status;
      
      this.updateUserActivity(
        userId,
        activity.socketId,
        currentStatus,
        activity.inGameId,
      );
    }
  }

  /**
   * Gets a user's activity status
   */
  getUserActivity(userId: string): UserActivity | undefined {
    return this.userActivities.get(userId);
  }

  /**
   * Gets a user's activity status by socket ID
   */
  getUserActivityBySocketId(socketId: string): UserActivity | undefined {
    const userId = this.socketToUserId.get(socketId);
    if (userId) {
      return this.getUserActivity(userId);
    }
    return undefined;
  }

  /**
   * Gets all users with their activity status
   */
  getAllUserActivities(): UserActivity[] {
    return Array.from(this.userActivities.values());
  }

  /**
   * Broadcasts user activity updates to subscribers
   */
  broadcastActivityUpdates(server: Server): void {
    const activities = this.getAllUserActivities();
    server.emit('user_activity_update', activities);
  }

  /**
   * Sets a timeout to mark a user as away after inactivity
   */
  private setAwayTimeout(userId: string): void {
    // Clear any existing timeout
    this.clearAwayTimeout(userId);

    // Set a new timeout
    const timeout = setTimeout(() => {
      const activity = this.userActivities.get(userId);
      if (activity && activity.status === UserActivityStatus.ONLINE) {
        this.updateUserActivity(
          userId,
          activity.socketId,
          UserActivityStatus.AWAY,
          activity.inGameId,
        );
      }
    }, this.awayTimeThreshold);

    this.awayTimeouts.set(userId, timeout);
  }

  /**
   * Clears the away timeout for a user
   */
  private clearAwayTimeout(userId: string): void {
    const timeout = this.awayTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.awayTimeouts.delete(userId);
    }
  }
} 