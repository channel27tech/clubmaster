import { io, Socket } from 'socket.io-client';
import { UserActivityStatus } from '../types/activity';

// Default server URL
const ACTIVITY_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Default connection options
const DEFAULT_OPTIONS = {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  path: '/socket.io',
};

// Activity socket instance
let activitySocket: Socket | null = null;

// Heartbeat interval ID
let heartbeatIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize and connect the activity socket
 * @param uid User ID for authentication
 * @returns Socket instance
 */
export const connectActivitySocket = (uid: string): Socket => {
  if (!activitySocket) {
    // Create a new socket connection to the activity namespace
    activitySocket = io(`${ACTIVITY_SERVER_URL}/activity`, {
      ...DEFAULT_OPTIONS,
      auth: { uid },
    });

    // Add connection handlers
    activitySocket.on('connect', () => {
      // Start sending heartbeats when connected
      startHeartbeat();
    });

    activitySocket.on('connect_error', (error) => {
    });

    activitySocket.on('disconnect', () => {
      // Stop heartbeats when disconnected
      stopHeartbeat();
    });
  }

  // Connect if not already connected
  if (!activitySocket.connected) {
    activitySocket.connect();
  }

  return activitySocket;
};

/**
 * Disconnect the activity socket
 */
export const disconnectActivitySocket = (): void => {
  if (activitySocket) {
    // Stop heartbeats
    stopHeartbeat();
    
    // Disconnect the socket
    activitySocket.disconnect();
    activitySocket = null;
  }
};

/**
 * Start sending heartbeats to keep the connection alive
 */
const startHeartbeat = (): void => {
  // Clear any existing interval
  stopHeartbeat();
  
  // Send initial heartbeat
  sendHeartbeat();
  
  // Set up interval to send heartbeats every 15 seconds
  heartbeatIntervalId = setInterval(sendHeartbeat, 15000);
};

/**
 * Stop sending heartbeats
 */
const stopHeartbeat = (): void => {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
};

/**
 * Send a heartbeat to the server
 */
const sendHeartbeat = (): void => {
  if (activitySocket?.connected) {
    activitySocket.emit('heartbeat');
  }
};

/**
 * Get all active users
 * @returns Promise that resolves with array of active users
 */
export const getActiveUsers = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (!activitySocket?.connected) {
      reject(new Error('Activity socket not connected'));
      return;
    }

    // Set up one-time handler for the response
    activitySocket.once('active_users', (data) => {
      resolve(data);
    });

    // Request active users
    activitySocket.emit('get_active_users');
    
    // Set a timeout to reject the promise if no response is received
    setTimeout(() => {
      reject(new Error('Timeout waiting for active users'));
    }, 5000);
  });
};

/**
 * Get activity status for a specific user
 * @param userId User ID to get status for
 * @returns Promise that resolves with user activity status
 */
export const getUserActivity = (userId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!activitySocket?.connected) {
      reject(new Error('Activity socket not connected'));
      return;
    }

    // Set up one-time handler for the response
    activitySocket.once('user_activity', (data) => {
      resolve(data);
    });

    // Request user activity
    activitySocket.emit('get_user_activity', { userId });
    
    // Set a timeout to reject the promise if no response is received
    setTimeout(() => {
      reject(new Error(`Timeout waiting for user activity for ${userId}`));
    }, 5000);
  });
};

/**
 * Register a callback for user activity updates
 * @param callback Function to call when user activity is updated
 */
export const onUserActivityUpdate = (callback: (data: any[]) => void): void => {
  if (activitySocket) {
    activitySocket.on('user_activity_update', callback);
  }
};

/**
 * Remove user activity update callback
 * @param callback Function to remove
 */
export const offUserActivityUpdate = (callback?: (data: any[]) => void): void => {
  if (activitySocket) {
    if (callback) {
      activitySocket.off('user_activity_update', callback);
    } else {
      activitySocket.off('user_activity_update');
    }
  }
};

/**
 * Register a callback for initial activity state
 * @param callback Function to call when initial activity state is received
 */
export const onInitialActivityState = (callback: (data: any[]) => void): void => {
  if (activitySocket) {
    activitySocket.on('initial_activity_state', callback);
  }
};

/**
 * Remove initial activity state callback
 * @param callback Function to remove
 */
export const offInitialActivityState = (callback?: (data: any[]) => void): void => {
  if (activitySocket) {
    if (callback) {
      activitySocket.off('initial_activity_state', callback);
    } else {
      activitySocket.off('initial_activity_state');
    }
  }
};

/**
 * Get formatted status text for a user activity status
 * @param status UserActivityStatus enum value
 * @returns Formatted status text
 */
export const getStatusText = (status: UserActivityStatus): string => {
  switch (status) {
    case UserActivityStatus.ONLINE:
      return 'Online';
    case UserActivityStatus.AWAY:
      return 'Away';
    case UserActivityStatus.OFFLINE:
      return 'Offline';
    case UserActivityStatus.IN_GAME:
      return 'In Game';
    default:
      return 'Unknown';
  }
};

/**
 * Get time elapsed since last activity
 * @param lastActive Date of last activity
 * @returns Formatted time elapsed text
 */
export const getTimeElapsed = (lastActive: Date): string => {
  const now = new Date();
  const lastActiveDate = new Date(lastActive);
  const diffMs = now.getTime() - lastActiveDate.getTime();
  
  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) {
    return `${diffSec} seconds ago`;
  }
  
  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);
  
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  }
  
  // Convert to hours
  const diffHours = Math.floor(diffMin / 60);
  
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  
  // Convert to days
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}; 