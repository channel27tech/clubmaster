'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as betService from '@/services/betService';
import { BetChallenge, BetType } from '@/types/bet';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface BetContextType {
  pendingBetChallenges: BetChallenge[];
  currentBetChallenge: BetChallenge | null;
  isShowingBetNotification: boolean;
  acceptBetChallenge: (challengeId: string) => void;
  rejectBetChallenge: (challengeId: string) => void;
  cancelBetChallenge: (betId: string) => void;
  sendBetChallenge: (options: {
    opponentId?: string;
    opponentSocketId?: string;
    betType: BetType;
    stakeAmount?: number;
    gameMode: string;
    timeControl: string;
    preferredSide: string;
  }) => Promise<{ success: boolean; betId?: string; expiresAt?: string; message?: string }>;
}

const BetContext = createContext<BetContextType | undefined>(undefined);

export const useBet = () => {
  const context = useContext(BetContext);
  if (context === undefined) {
    throw new Error('useBet must be used within a BetProvider');
  }
  return context;
};

interface BetProviderProps {
  children: ReactNode;
}

export const BetProvider: React.FC<BetProviderProps> = ({ children }) => {
  const [pendingBetChallenges, setPendingBetChallenges] = useState<BetChallenge[]>([]);
  const [currentBetChallenge, setCurrentBetChallenge] = useState<BetChallenge | null>(null);
  const [isShowingBetNotification, setIsShowingBetNotification] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useSocket();

  useEffect(() => {
    // Set up socket event listeners for bet challenges
    const handleBetChallengeReceived = (challenge: BetChallenge) => {
      console.log('[BetContext] Bet challenge received:', challenge);
      
      try {
        // Validate essential fields
        if (!challenge.id) {
          console.error('[BetContext] Bet challenge missing ID:', challenge);
          return;
        }
        
        // Log detailed information about the challenge for debugging
        console.log(`[BetContext] Challenge details:
          - ID: ${challenge.id}
          - From user: ${challenge.senderId || 'Unknown'} (${challenge.challengerName || challenge.senderUsername || 'Unknown user'})
          - Challenger Name: ${challenge.challengerName}
          - Sender Username: ${challenge.senderUsername}
          - Bet type: ${challenge.betType}
          - Game mode: ${challenge.gameMode || 'Unknown'}
          - Time control: ${challenge.timeControl || 'Unknown'}
        `);
        
        // Update state to show notification
        setCurrentBetChallenge(challenge);
        setIsShowingBetNotification(true);
        
        // Log successful notification display
        console.log('[BetContext] Bet challenge notification shown for challenge:', challenge.id);
      } catch (error) {
        console.error('[BetContext] Error handling bet challenge:', error);
      }
    };

    const handleBetChallengeResponse = (response: any) => {
      console.log('Bet challenge response received:', response);
      if (response.accepted) {
        // If challenge was accepted, navigate to waiting screen
        // The actual game start will be handled by the matchFound event
        router.push('/play');
      } else {
        // If challenge was rejected, show notification
        console.log('Bet challenge rejected');
        // TODO: Add toast notification for rejection
      }
    };

    const handleBetChallengeExpired = (data: { betId: string }) => {
      console.log('Bet challenge expired:', data);
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        // TODO: Add toast notification for expiration
      }
    };

    const handleBetChallengeCancelled = (data: { betId: string }) => {
      console.log('Bet challenge cancelled:', data);
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        // TODO: Add toast notification for cancellation
      }
    };

    const handlePendingBetChallenges = (data: { challenges: BetChallenge[] }) => {
      console.log('Pending bet challenges received:', data);
      setPendingBetChallenges(data.challenges);
    };

    // Register event listeners
    betService.onBetChallengeReceived(handleBetChallengeReceived);
    betService.onBetChallengeResponse(handleBetChallengeResponse);
    betService.onBetChallengeExpired(handleBetChallengeExpired);
    betService.onBetChallengeCancelled(handleBetChallengeCancelled);
    betService.onPendingBetChallenges(handlePendingBetChallenges);

    // Get any pending bet challenges when the component mounts and socket is connected
    if (user && isConnected) {
      console.log('Fetching pending bet challenges...');
      betService.getPendingBetChallenges();
    }

    // Clean up listeners when component unmounts
    return () => {
      betService.offBetChallengeReceived();
      betService.offBetChallengeResponse();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      betService.offPendingBetChallenges();
    };
  }, [currentBetChallenge, router, user, isConnected]);

  // Add a separate effect to re-fetch pending challenges when socket reconnects
  useEffect(() => {
    if (user && isConnected) {
      console.log('Socket connected or reconnected, fetching pending bet challenges...');
      betService.getPendingBetChallenges();
    }
  }, [isConnected, user]);

  const acceptBetChallenge = (challengeId: string) => {
    betService.respondToBetChallenge(challengeId, true);
    setIsShowingBetNotification(false);
    setCurrentBetChallenge(null);
  };

  const rejectBetChallenge = (challengeId: string) => {
    betService.respondToBetChallenge(challengeId, false);
    setIsShowingBetNotification(false);
    setCurrentBetChallenge(null);
  };

  const cancelBetChallenge = (betId: string) => {
    betService.cancelBetChallenge(betId);
  };

  const sendBetChallenge = (options: {
    opponentId?: string;
    opponentSocketId?: string;
    betType: BetType;
    stakeAmount?: number;
    gameMode: string;
    timeControl: string;
    preferredSide: string;
  }) => {
    return betService.sendBetChallenge(options);
  };

  return (
    <BetContext.Provider
      value={{
        pendingBetChallenges,
        currentBetChallenge,
        isShowingBetNotification,
        acceptBetChallenge,
        rejectBetChallenge,
        cancelBetChallenge,
        sendBetChallenge,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}; 