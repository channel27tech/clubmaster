import * as socketService from './socketService';
import { BetType, BetChallenge, BetResult } from '@/types/bet';
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
      // Add a flag to track if the promise was resolved
      let isResolved = false;
      
      // Send with acknowledgment callback
      socket.emit('create_bet_challenge', options, (response: any) => {
        // Only resolve if we haven't already
        if (!isResolved) {
          isResolved = true;
          if (response && response.success) {
            resolve({ 
              success: true, 
              betId: response.betId || response.data?.betId, 
              expiresAt: response.expiresAt || response.data?.expiresAt 
            });
          } else {
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
    
    // Add a simple acknowledgment event handler if the server sends one
    socket.once('bet_cancel_success', (response) => {
    });
    
    socket.once('bet_cancel_error', (error) => {
    });
  }
};

/**
 * Respond to a bet challenge (accept or reject)
 */
export const respondToBetChallenge = (challengeId: string, accepted: boolean): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('respond_to_bet_challenge', { challengeId, accepted });
  }
};

/**
 * Get pending bet challenges for the current user
 */
export const getPendingBetChallenges = (): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('get_pending_bet_challenges');
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
      try {
        // Validate essential data is present
        if (!data || !data.id) {
          return;
        }
        // Detailed logging of incoming data fields
        // console.log('[betService] Incoming data fields:', { ... });
        // Get the profile image URL with proper fallback chain
        const profileImageUrl = data.senderPhotoURL || 
                               data.photoURL || 
                               data.profileImage || 
                               data.avatarUrl || 
                               data.challengerPhotoURL || 
                               null;
        // Log the resolved profile image
        // console.log('[betService] Resolved profile image URL:', profileImageUrl);
        // Create a properly formatted challenge object
        const challenge: BetChallenge = {
          id: data.id,
          challengerId: data.senderId,
          challengerName: data.senderUsername || data.challengerName || data.displayName || data.name || 'Unknown Challenger',
          challengerRating: data.senderRating,
          challengerPhotoURL: profileImageUrl,
          betType: data.betType,
          stakeAmount: data.stakeAmount,
          gameMode: data.gameMode || 'Rapid',
          timeControl: data.timeControl || '10+0',
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 60000),
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderPhotoURL: data.senderPhotoURL || null
        };
        // console.log('[betService] Formatted challenge for callback:', challenge);
        // console.log('[betService] Challenger name set to:', challenge.challengerName);
        // console.log('[betService] Challenger photo URL set to:', challenge.challengerPhotoURL);
        // Call the callback with the processed challenge data
        callback(challenge);
      } catch (error) {
      }
    });
    // console.log('[betService] Registered bet_challenge_received listener');
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
    // console.log('[betService] Removed bet_challenge_received listener');
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
      if (!data) {
        return;
      }
      // Log detailed information about the response for debugging
      // console.log('[betService] Response details:', { ... });
      callback(data);
    });
    // console.log('[betService] Registered bet_challenge_response listener');
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
export const onBetResult = (callback: (result: BetResult) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.off('bet_result');
    socket.on('bet_result', (data: BetResult) => {
      console.log('[betService] Received bet_result event:', data);
      callback(data);
    });
  }
};

/**
 * Remove the bet result listener
 */
export const offBetResult = (callback?: (result: BetResult) => void): void => {
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
      // Emit event to get bet challenge status
      socket.emit('get_bet_challenge_status', { betId }, (response: any) => {
        if (response && response.success) {
          resolve({
            status: response.status,
            betId: response.betId,
            message: response.message,
            gameId: response.gameId
          });
        } else {
          reject(new Error(response?.message || 'Failed to get bet challenge status'));
        }
      });
      
      // Add timeout in case server doesn't respond
      setTimeout(() => {
        reject(new Error('Timeout waiting for bet challenge status'));
      }, 5000);
    } else {
      reject(new Error('Socket not connected'));
    }
  });
};

/**
 * Add a listener for bet game ready event
 */
export const onBetGameReady = (callback: (data: { gameId: string, betType: BetType, betId: string }) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    // Remove existing listeners to prevent duplicates
    socket.off('bet_game_ready');
    
    // Add a listener for the bet_game_ready event
    socket.on('bet_game_ready', (data) => {
      try {
        if (!data || !data.gameId) {
          console.error('[betService] Invalid bet_game_ready data:', data);
          return;
        }
        
        // Log the event
        console.log('[betService] Game ready event received:', data);
        
        // Ensure required properties are set
        const gameData = {
          gameId: data.gameId,
          betType: data.betType || BetType.RATING_STAKE, // Default to rating stake if not specified
          betId: data.betId || localStorage.getItem('activeBetChallengeId') || 'unknown'
        };
        
        // Call the callback with the game data
        callback(gameData);
      } catch (error) {
        console.error('[betService] Error processing bet_game_ready event:', error);
      }
    });
    
    console.log('[betService] Registered bet_game_ready listener');
  } else {
    console.warn('[betService] Socket not available for onBetGameReady');
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

/**
 * Update a user's profile with profile control permissions
 */
export const updateControlledProfile = async (
  targetUserId: string,
  updateData: { nickname?: string; avatarType?: string }
): Promise<any> => {
  try {
    const response = await fetch(`/api/bet/profile-control?targetUserId=${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      throw new Error(`Error updating profile: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in updateControlledProfile:', error);
    throw error;
  }
};

/**
 * Check if current user has control over the target user's profile
 */
export const checkProfileControl = async (targetUserId: string): Promise<any> => {
  try {
    const response = await fetch(`/api/bet/profile-control/check?targetUserId=${targetUserId}`);
    
    if (!response.ok) {
      throw new Error(`Error checking profile control: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in checkProfileControl:', error);
    throw error;
  }
};

/**
 * Check current user's profile lock status
 */
export const checkProfileLockStatus = async (): Promise<any> => {
  try {
    const response = await fetch('/api/bet/profile-lock/status');
    
    if (!response.ok) {
      throw new Error(`Error checking profile lock status: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in checkProfileLockStatus:', error);
    throw error;
  }
};

/**
 * Save bet result to localStorage for persistence
 */
export const saveBetResult = (result: BetResult): void => {
  try {
    // Include timestamp for expiration checks
    const resultWithTimestamp = {
      ...result,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`bet_result_${result.betId}`, JSON.stringify(resultWithTimestamp));
    
    if (result.gameId) {
      localStorage.setItem(`bet_for_game_${result.gameId}`, result.betId);
    }
    
    console.log(`[betService] Saved bet result for bet ID ${result.betId}`);
  } catch (error) {
    console.error('[betService] Error saving bet result:', error);
  }
};

/**
 * Get bet result from localStorage
 */
export const getBetResult = (betId: string): BetResult | null => {
  try {
    const resultStr = localStorage.getItem(`bet_result_${betId}`);
    if (!resultStr) return null;
    
    return JSON.parse(resultStr);
  } catch (error) {
    console.error('[betService] Error retrieving bet result:', error);
    return null;
  }
};

/**
 * Get bet ID associated with a game ID
 */
export const getBetIdFromGameId = (gameId: string): string | null => {
  try {
    return localStorage.getItem(`bet_for_game_${gameId}`);
  } catch (error) {
    console.error('[betService] Error retrieving bet ID from game ID:', error);
    return null;
  }
}; 