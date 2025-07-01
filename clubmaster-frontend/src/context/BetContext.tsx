'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as betService from '@/services/betService';
import { BetChallenge, BetType, BetResult } from '@/types/bet';
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
  currentBetResult: BetResult | null;
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
  const [currentBetResult, setCurrentBetResult] = useState<BetResult | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const toast = useToast();

  useEffect(() => {
    // Set up socket event listeners for bet challenges
    const handleBetChallengeReceived = (challenge: BetChallenge) => {
      try {
        // Validate essential fields
        if (!challenge.id) {
          return;
        }
      
        // Update state to show notification
      setCurrentBetChallenge(challenge);
      setIsShowingBetNotification(true);
      } catch (error) {
      }
    };

    const handleBetChallengeResponse = (response: any) => {
      if (response.accepted) {
        // If challenge was accepted, clear the current challenge and notification
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        
        // Show a toast notification that the challenge was accepted
        toast.success('Bet challenge accepted, setting up the game...');
      } else {
        // If challenge was rejected, clear the current challenge and notification
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        
        // Get responder name if available
        const responderName = response.responderName || response.responderId || 'Opponent';
        
        // Show a more informative toast notification
        toast.info(`${responderName} declined the bet challenge`);
      }
    };

    const handleBetChallengeExpired = (data: { betId: string }) => {
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        toast.warning('Bet challenge expired');
      }
    };

    const handleBetChallengeCancelled = (data: { betId: string }) => {
      if (currentBetChallenge?.id === data.betId) {
        setCurrentBetChallenge(null);
        setIsShowingBetNotification(false);
        toast.info('Bet challenge cancelled by opponent');
      }
    };

    const handlePendingBetChallenges = (data: { challenges: BetChallenge[] }) => {
      setPendingBetChallenges(data.challenges);
    };

    const handleBetResult = (result: BetResult) => {
      console.log('[BetContext] Setting currentBetResult:', result);
      setCurrentBetResult(result);
    };

    // Add handler for bet_game_ready event
    const handleBetGameReady = (data: { gameId: string; betType: BetType; betId: string }) => {
      if (data && data.gameId) {
        // Show a success toast
        toast.success('Game ready! Redirecting to the game...');
        
        // Get opponent information from the bet challenge if available
        const opponentId = currentBetChallenge?.opponentId || null;
        
        // Build URL with query parameters including bet context
        const queryParams = new URLSearchParams({
          isBetGame: 'true',
          betType: data.betType,
          betId: data.betId
        });
        
        // Add opponent ID if available
        if (opponentId) {
          queryParams.append('opponentId', opponentId);
        }
        
        console.log('[BetContext] Navigating to game with bet context:', {
          gameId: data.gameId,
          betType: data.betType,
          betId: data.betId,
          opponentId
        });
        
        // Navigate to the game page with bet context in the protected route
        router.push(`/play/game/${data.gameId}?${queryParams.toString()}`);
      } else {
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
      betService.getPendingBetChallenges();
    }

    // Clean up listeners when component unmounts
    return () => {
      betService.offBetChallengeReceived();
      betService.offBetChallengeResponse();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      betService.offPendingBetChallenges();
      betService.offBetResult(handleBetResult);
      betService.offBetGameReady(); // Remove listener for bet_game_ready
    };
  }, [currentBetChallenge, router, user, isConnected, toast]);

  useEffect(() => {
    console.log('[BetContext] currentBetResult changed:', currentBetResult);
  }, [currentBetResult]);

  // Add a separate effect to re-fetch pending challenges when socket reconnects
  useEffect(() => {
    if (user && isConnected) {
      betService.getPendingBetChallenges();
    }
  }, [isConnected, user]);

  const acceptBetChallenge = (challengeId: string) => {
    if (!challengeId) {
      toast.error('Invalid challenge ID');
      return;
    }

    try {
      // Find the challenge in the pending challenges
      const challenge = pendingBetChallenges.find(c => c.id === challengeId) || 
                       (currentBetChallenge?.id === challengeId ? currentBetChallenge : null);
      
      if (!challenge) {
        toast.error('Challenge not found');
        return;
      }

      // Accept the challenge through the bet service
      betService.respondToBetChallenge(challengeId, true);
      
      // Clear the current challenge notification
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      
      // Show a toast notification
      toast.success('Bet challenge accepted, setting up the game...');
      
      // Store bet challenge info in localStorage for reference
      localStorage.setItem('activeBetChallengeId', challengeId);
      localStorage.setItem('activeBetType', challenge.betType);
      if (challenge.stakeAmount) {
        localStorage.setItem('activeBetStakeAmount', challenge.stakeAmount.toString());
      }
      
      // The game setup will be handled by the server and the matchmaking system
      // The server will send a bet_game_ready event when the game is ready
    } catch (error) {
      console.error('Error accepting bet challenge:', error);
      toast.error('Failed to accept challenge');
    }
  };

  const rejectBetChallenge = (challengeId: string) => {
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
        currentBetResult,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}; 