'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as betService from '@/services/betService';
import { BetChallenge, BetType } from '@/types/bet';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from '@/hooks/useToast';

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
  currentBetResult: any | null;
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
  const [currentBetResult, setCurrentBetResult] = useState<any | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const toast = useToast();

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
      console.log('[BetContext] Bet challenge response received:', response);
      
      if (response.accepted) {
        // If challenge was accepted, clear the current challenge and notification
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        
        // Show a toast notification that the challenge was accepted
        toast.success('Bet challenge accepted, setting up the game...');
        console.log('[BetContext] Bet challenge accepted, waiting for game to start...');
        
        // For the sender, we need to close the waiting screen
        // The matchFound event will handle navigation to the game for both players
        
        // Listen for matchFound event to navigate to the game
        // This is handled in the MatchmakingManager component
      } else {
        // If challenge was rejected, clear the current challenge and notification
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        
        // Get responder name if available
        const responderName = response.responderName || response.responderId || 'Opponent';
        
        // Show a more informative toast notification
        toast.info(`${responderName} declined the bet challenge`);
        console.log('[BetContext] Bet challenge rejected by:', responderName);
      }
    };

    const handleBetChallengeExpired = (data: { betId: string }) => {
      console.log('[BetContext] Bet challenge expired:', data);
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        toast.warning('Bet challenge expired');
      }
    };

    const handleBetChallengeCancelled = (data: { betId: string }) => {
      console.log('[BetContext] Bet challenge cancelled:', data);
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        toast.info('Bet challenge cancelled by opponent');
        console.log('[BetContext] Bet challenge notification closed due to cancellation by sender');
      }
    };

    const handlePendingBetChallenges = (data: { challenges: BetChallenge[] }) => {
      console.log('[BetContext] Pending bet challenges received:', data);
      setPendingBetChallenges(data.challenges);
    };

    const handleBetResult = (result: any) => {
      console.log('[BetContext] Bet result received:', result);
      setCurrentBetResult(result);
      
      // You may want to show a notification or redirect to a results page
      // depending on your application flow
    };

    // Add handler for bet_game_ready event
    const handleBetGameReady = (data: { gameId: string }) => {
      console.log('[BetContext] Bet game ready event received:', data);
      
      if (data && data.gameId) {
        // Show a success toast
        toast.success('Game ready! Redirecting to the game...');
        
        // Navigate to the game page
        console.log(`[BetContext] Navigating to game: /play/game/${data.gameId}`);
        router.push(`/play/game/${data.gameId}`);
      } else {
        console.error('[BetContext] Invalid bet_game_ready data received:', data);
        toast.error('Could not start game: Invalid game data received');
      }
    };

    // Register event listeners
    betService.onBetChallengeReceived(handleBetChallengeReceived);
    betService.onBetChallengeResponse(handleBetChallengeResponse);
    betService.onBetChallengeExpired(handleBetChallengeExpired);
    betService.onBetChallengeCancelled(handleBetChallengeCancelled);
    betService.onPendingBetChallenges(handlePendingBetChallenges);
    betService.onBetResult(handleBetResult);
    betService.onBetGameReady(handleBetGameReady); // Add listener for bet_game_ready

    // Get any pending bet challenges when the component mounts and socket is connected
    if (user && isConnected) {
      console.log('[BetContext] Fetching pending bet challenges...');
      betService.getPendingBetChallenges();
    }

    // Clean up listeners when component unmounts
    return () => {
      betService.offBetChallengeReceived();
      betService.offBetChallengeResponse();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      betService.offPendingBetChallenges();
      betService.offBetResult();
      betService.offBetGameReady(); // Remove listener for bet_game_ready
    };
  }, [currentBetChallenge, router, user, isConnected, toast]);

  // Add a separate effect to re-fetch pending challenges when socket reconnects
  useEffect(() => {
    if (user && isConnected) {
      console.log('[BetContext] Socket connected or reconnected, fetching pending bet challenges...');
      betService.getPendingBetChallenges();
    }
  }, [isConnected, user]);

  const acceptBetChallenge = (challengeId: string) => {
    console.log(`[BetContext] Accepting bet challenge: ${challengeId}`);
    betService.respondToBetChallenge(challengeId, true);
    setIsShowingBetNotification(false);
    setCurrentBetChallenge(null);
    
    // Show an info toast instead of loading since loading is not available
    toast.info('Accepting challenge and setting up the game...');
  };

  const rejectBetChallenge = (challengeId: string) => {
    console.log(`[BetContext] Rejecting bet challenge: ${challengeId}`);
    
    // Get challenger name for the notification
    const challengerName = currentBetChallenge?.challengerName || 
                           currentBetChallenge?.senderUsername || 
                           'Challenger';
    
    // Send the rejection to the backend
    betService.respondToBetChallenge(challengeId, false);
    
    // Clear the notification state
    setIsShowingBetNotification(false);
    setCurrentBetChallenge(null);
    
    // Show a more informative toast notification
    toast.info(`You declined ${challengerName}'s challenge`);
  };

  const cancelBetChallenge = (betId: string) => {
    console.log(`[BetContext] Cancelling bet challenge: ${betId}`);
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
    console.log('[BetContext] Sending bet challenge with options:', options);
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
        currentBetResult,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}; 