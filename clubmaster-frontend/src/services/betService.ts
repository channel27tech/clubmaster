import * as socketService from './socketService';
import { BetType, BetChallenge } from '@/types/bet';
import { Socket } from 'socket.io-client';

/**
 * Send a bet challenge to another player
 * @returns Promise that resolves with the result of the bet challenge creation
 */
export const sendBetChallenge = (options: {
  opponentId?: string;
  opponentSocketId?: string;
  betType: BetType;
  stakeAmount?: number;
  gameMode: string;
  timeControl: string;
  preferredSide: string;
}): Promise<{ success: boolean; betId?: string; expiresAt?: string; message?: string }> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      console.log('Attempting to send create_bet_challenge event with options:', options);
      
      // Add a flag to track if the promise was resolved
      let isResolved = false;
      
      // Send with acknowledgment callback
      socket.emit('create_bet_challenge', options, (response: any) => {
        // Only resolve if we haven't already
        if (!isResolved) {
          isResolved = true;
          if (response && response.success) {
            console.log('Bet challenge created successfully:', response);
            resolve({ 
              success: true, 
              betId: response.betId || response.data?.betId, 
              expiresAt: response.expiresAt || response.data?.expiresAt 
            });
          } else {
            console.error('Failed to create bet challenge:', response);
            resolve({ 
              success: false, 
              message: response?.message || response?.data?.message || 'Failed to create bet challenge' 
            });
          }
        }
      });
      
      // Add a timeout in case the server never responds
      setTimeout(() => {
        // Only resolve if we haven't already
        if (!isResolved) {
          isResolved = true;
          console.warn('Bet challenge creation timeout - assuming failed');
          resolve({ success: false, message: 'Timeout waiting for server response' });
        }
      }, 10000); // 10 second timeout
    } else {
      console.error('Cannot send bet challenge: Socket not connected');
      resolve({ success: false, message: 'Socket not connected' });
    }
  });
};

/**
 * Cancel a bet challenge
 */
export const cancelBetChallenge = (betId: string): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('cancel_bet_challenge', { betId });
  } else {
    console.error('Cannot cancel bet challenge: Socket not connected');
  }
};

/**
 * Respond to a bet challenge (accept or reject)
 */
export const respondToBetChallenge = (challengeId: string, accepted: boolean): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('respond_to_bet_challenge', { challengeId, accepted });
  } else {
    console.error('Cannot respond to bet challenge: Socket not connected');
  }
};

/**
 * Get pending bet challenges for the current user
 */
export const getPendingBetChallenges = (): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('get_pending_bet_challenges');
  } else {
    console.error('Cannot get pending bet challenges: Socket not connected');
  }
};

/**
 * Add a listener for incoming bet challenges
 */
export const onBetChallengeReceived = (callback: (challenge: BetChallenge) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    // Remove any existing listeners to prevent duplicates
    socket.off('bet_challenge_received');
    
    // Add the new listener with clear logging
    socket.on('bet_challenge_received', (data: any) => {
      console.log('[betService] Bet challenge received event:', data);
      try {
        // Validate essential data is present
        if (!data || !data.id) {
          console.error('[betService] Invalid bet challenge data received:', data);
          return;
        }

        // Detailed logging of incoming data fields
        console.log('[betService] Incoming data fields:', {
          id: data.id,
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderRating: data.senderRating,
          senderPhotoURL: data.senderPhotoURL,
          betType: data.betType
        });

        // Create a properly formatted challenge object
        const challenge: BetChallenge = {
          id: data.id,
          challengerId: data.senderId,
          // Enhanced name resolution with multiple fallbacks
          challengerName: data.senderUsername || data.challengerName || data.displayName || data.name || 'Unknown Challenger',
          challengerRating: data.senderRating,
          // Add profile photo URL with fallbacks
          challengerPhotoURL: data.senderPhotoURL || data.photoURL || data.profileImage || data.avatarUrl || null,
          betType: data.betType,
          stakeAmount: data.stakeAmount,
          gameMode: data.gameMode || 'Rapid',
          timeControl: data.timeControl || '10+0',
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 60000),
          // Keep original fields for backward compatibility
          senderId: data.senderId,
          senderUsername: data.senderUsername
        };
        
        console.log('[betService] Formatted challenge for callback:', challenge);
        console.log('[betService] Challenger name set to:', challenge.challengerName);
        
        // Call the callback with the processed challenge data
        callback(challenge);
      } catch (error) {
        console.error('[betService] Error handling bet challenge received:', error);
      }
    });
    
    console.log('[betService] Registered bet_challenge_received listener');
  } else {
    console.warn('[betService] Cannot register bet_challenge_received listener: Socket not available');
  }
};

/**
 * Remove the bet challenge received listener
 */
export const offBetChallengeReceived = (callback?: (challenge: BetChallenge) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_challenge_received', callback);
    } else {
      socket.off('bet_challenge_received');
    }
    console.log('[betService] Removed bet_challenge_received listener');
  }
};

/**
 * Add a listener for bet challenge response
 */
export const onBetChallengeResponse = (callback: (response: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_challenge_response', callback);
  }
};

/**
 * Remove the bet challenge response listener
 */
export const offBetChallengeResponse = (callback?: (response: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_challenge_response', callback);
    } else {
      socket.off('bet_challenge_response');
    }
  }
};

/**
 * Add a listener for bet challenge expiration
 */
export const onBetChallengeExpired = (callback: (data: { betId: string }) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_challenge_expired', callback);
  }
};

/**
 * Remove the bet challenge expiration listener
 */
export const offBetChallengeExpired = (callback?: (data: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_challenge_expired', callback);
    } else {
      socket.off('bet_challenge_expired');
    }
  }
};

/**
 * Add a listener for bet challenge cancellation
 */
export const onBetChallengeCancelled = (callback: (data: { betId: string }) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_challenge_cancelled', callback);
  }
};

/**
 * Remove the bet challenge cancellation listener
 */
export const offBetChallengeCancelled = (callback?: (data: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_challenge_cancelled', callback);
    } else {
      socket.off('bet_challenge_cancelled');
    }
  }
};

/**
 * Add a listener for bet result
 */
export const onBetResult = (callback: (result: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_result', callback);
  }
};

/**
 * Remove the bet result listener
 */
export const offBetResult = (callback?: (result: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_result', callback);
    } else {
      socket.off('bet_result');
    }
  }
};

/**
 * Add a listener for pending bet challenges
 */
export const onPendingBetChallenges = (callback: (data: { challenges: any[] }) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('pending_bet_challenges', callback);
  }
};

/**
 * Remove the pending bet challenges listener
 */
export const offPendingBetChallenges = (callback?: (data: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('pending_bet_challenges', callback);
    } else {
      socket.off('pending_bet_challenges');
    }
  }
}; 