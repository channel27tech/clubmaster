import * as socketService from './socketService';
import { BetType } from '@/types/bet';
import { Socket } from 'socket.io-client';

/**
 * Send a bet challenge to another player
 */
export const sendBetChallenge = (options: {
  opponentId?: string;
  opponentSocketId?: string;
  betType: BetType;
  stakeAmount?: number;
  gameMode: string;
  timeControl: string;
  preferredSide: string;
}): void => {
  const socket = socketService.getSocket();
  if (socket?.connected) {
    socket.emit('create_bet_challenge', options);
  } else {
    console.error('Cannot send bet challenge: Socket not connected');
  }
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
export const onBetChallengeReceived = (callback: (challenge: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('bet_challenge_received', callback);
  }
};

/**
 * Remove the bet challenge received listener
 */
export const offBetChallengeReceived = (callback?: (challenge: any) => void): void => {
  const socket = socketService.getSocket();
  if (socket) {
    if (callback) {
      socket.off('bet_challenge_received', callback);
    } else {
      socket.off('bet_challenge_received');
    }
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