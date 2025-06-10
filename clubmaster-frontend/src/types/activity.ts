/**
 * User activity status enum
 */
export enum UserActivityStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
  IN_GAME = 'in-game',
}

/**
 * User activity interface
 */
export interface UserActivity {
  userId: string;
  socketId: string;
  status: UserActivityStatus;
  lastActive: Date;
  inGameId?: string;
}

/**
 * User activity with additional profile data
 */
export interface UserActivityWithProfile extends UserActivity {
  displayName?: string;
  photoURL?: string;
  email?: string;
} 