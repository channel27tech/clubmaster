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
      
      // We've removed the timeout as we want the waiting screen to stay visible
      // until manually cancelled by the user
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
    console.log(`[betService] Cancelling bet challenge with ID: ${betId}`);
    socket.emit('cancel_bet_challenge', { betId });
    
    // Add a simple acknowledgment event handler if the server sends one
    socket.once('bet_cancel_success', (response) => {
      console.log('[betService] Bet challenge successfully cancelled:', response);
    });
    
    socket.once('bet_cancel_error', (error) => {
      console.error('[betService] Error cancelling bet challenge:', error);
    });
  } else {
    console.error('[betService] Cannot cancel bet challenge: Socket not connected');
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
          profileImage: data.profileImage,
          photoURL: data.photoURL,
          avatarUrl: data.avatarUrl,
          betType: data.betType
        });

        // Get the profile image URL with proper fallback chain
        const profileImageUrl = data.senderPhotoURL || 
                               data.photoURL || 
                               data.profileImage || 
                               data.avatarUrl || 
                               data.challengerPhotoURL || 
                               null;
        
        // Log the resolved profile image
        console.log('[betService] Resolved profile image URL:', profileImageUrl);

        // Create a properly formatted challenge object
        const challenge: BetChallenge = {
          id: data.id,
          challengerId: data.senderId,
          // Enhanced name resolution with multiple fallbacks
          challengerName: data.senderUsername || data.challengerName || data.displayName || data.name || 'Unknown Challenger',
          challengerRating: data.senderRating,
          // Add profile photo URL with fallbacks
          challengerPhotoURL: profileImageUrl,
          betType: data.betType,
          stakeAmount: data.stakeAmount,
          gameMode: data.gameMode || 'Rapid',
          timeControl: data.timeControl || '10+0',
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 60000),
          // Keep original fields for backward compatibility
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderPhotoURL: data.senderPhotoURL || null
        };
        
        console.log('[betService] Formatted challenge for callback:', challenge);
        console.log('[betService] Challenger name set to:', challenge.challengerName);
        console.log('[betService] Challenger photo URL set to:', challenge.challengerPhotoURL);
        
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
    // Remove any existing listeners to prevent duplicates
    socket.off('bet_challenge_response');
    
    // Add the new listener with enhanced logging
    socket.on('bet_challenge_response', (data: any) => {
      console.log('[betService] Bet challenge response received:', data);
      
      // Ensure we have a valid response object
      if (!data) {
        console.error('[betService] Empty bet challenge response received');
        return;
      }
      
      // Log detailed information about the response for debugging
      console.log('[betService] Response details:', {
        betId: data.betId || 'Missing',
        accepted: data.accepted,
        responderName: data.responderName || data.responderId || 'Unknown',
        gameId: data.gameId || 'Not yet created'
      });
      
      // Call the callback with the response data
      callback(data);
    });
    
    console.log('[betService] Registered bet_challenge_response listener');
  } else {
    console.warn('[betService] Cannot register bet_challenge_response listener: Socket not available');
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
 * Add a listener for bet results
 */
export const onBetResult = (callback: (result: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_result', (data) => {
      console.log('[betService] Bet result received:', data);
      callback(data);
    });
    console.log('[betService] Registered bet_result listener');
  } else {
    console.warn('[betService] Cannot register bet_result listener: Socket not available');
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
    console.log('[betService] Removed bet_result listener');
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

/**
 * Check the status of a bet challenge
 * @param betId The ID of the bet challenge to check
 * @returns Promise that resolves with the status of the bet challenge
 */
export const checkBetChallengeStatus = (betId: string): Promise<{ 
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired' | 'completed';
  betId: string;
  message?: string;
  gameId?: string;
}> => {
  return new Promise((resolve, reject) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      console.log(`[betService] Checking status of bet challenge with ID: ${betId}`);
      
      // Emit event to get bet challenge status
      socket.emit('get_bet_challenge_status', { betId }, (response: any) => {
        if (response && response.success) {
          console.log('[betService] Bet challenge status retrieved:', response);
          resolve({
            status: response.status,
            betId: response.betId,
            message: response.message,
            gameId: response.gameId
          });
        } else {
          console.error('[betService] Failed to get bet challenge status:', response);
          reject(new Error(response?.message || 'Failed to get bet challenge status'));
        }
      });
      
      // Add timeout in case server doesn't respond
      setTimeout(() => {
        reject(new Error('Timeout waiting for bet challenge status'));
      }, 5000);
    } else {
      console.error('[betService] Cannot check bet challenge status: Socket not connected');
      reject(new Error('Socket not connected'));
    }
  });
};

/**
 * Add a listener for bet game ready event (special event for bet games)
 */
export const onBetGameReady = (callback: (data: { gameId: string }) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.off('bet_game_ready'); // Remove any existing listeners
    socket.on('bet_game_ready', (data) => {
      console.log('[betService] Bet game ready event received:', data);
      if (data && data.gameId) {
        callback(data);
      } else {
        console.error('[betService] Invalid bet_game_ready data received:', data);
      }
    });
    console.log('[betService] Registered bet_game_ready listener');
  } else {
    console.warn('[betService] Cannot register bet_game_ready listener: Socket not available');
  }
};

/**
 * Remove the bet game ready listener
 */
export const offBetGameReady = (callback?: (data: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_game_ready', callback);
    } else {
      socket.off('bet_game_ready');
    }
    console.log('[betService] Removed bet_game_ready listener');
  }
}; 