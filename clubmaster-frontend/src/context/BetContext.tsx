'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
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

  // Stable refs for external dependencies
  const currentBetChallengeRef = useRef(currentBetChallenge);
  useEffect(() => { currentBetChallengeRef.current = currentBetChallenge; }, [currentBetChallenge]);

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Memoized handler functions using only refs (no external deps)
  const handleBetChallengeReceived = useCallback((challenge: BetChallenge) => {
    try {
      if (!challenge.id) return;
      setCurrentBetChallenge(challenge);
      setIsShowingBetNotification(true);
    } catch (error) {}
  }, []);

  const handleBetChallengeResponse = useCallback((response: any) => {
    if (response.accepted) {
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      toastRef.current.success('Bet challenge accepted, setting up the game...');
    } else {
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      const responderName = response.responderName || response.responderId || 'Opponent';
      toastRef.current.info(`${responderName} declined the bet challenge`);
    }
  }, []);

  const handleBetChallengeExpired = useCallback((data: { betId: string }) => {
    if (currentBetChallengeRef.current?.id === data.betId) {
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      toastRef.current.warning('Bet challenge expired');
    }
  }, []);

  const handleBetChallengeCancelled = useCallback((data: { betId: string }) => {
    if (currentBetChallengeRef.current?.id === data.betId) {
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      toastRef.current.info('Bet challenge cancelled by opponent');
    }
  }, []);

  const handlePendingBetChallenges = useCallback((data: { challenges: BetChallenge[] }) => {
    setPendingBetChallenges(data.challenges);
  }, []);

  const handleBetResult = useCallback((result: BetResult) => {
    console.log('[BetContext] Setting currentBetResult:', result);
    setCurrentBetResult(result);
  }, []);

  const handleBetGameReady = useCallback((data: { gameId: string; betType: BetType; betId: string }) => {
    if (data && data.gameId) {
      toastRef.current.success('Game ready! Redirecting to the game...');
      const opponentId = currentBetChallengeRef.current?.opponentId || null;
      const queryParams = new URLSearchParams({
        isBetGame: 'true',
        betType: data.betType,
        betId: data.betId
      });
      if (opponentId) {
        queryParams.append('opponentId', opponentId);
      }
      console.log('[BetContext] Navigating to game with bet context:', {
        gameId: data.gameId,
        betType: data.betType,
        betId: data.betId,
        opponentId
      });
      routerRef.current.push(`/play/game/${data.gameId}?${queryParams.toString()}`);
    } else {
      toastRef.current.error('Could not start game: Invalid game data received');
    }
  }, []);

  // Register socket listeners only once on mount/unmount
  useEffect(() => {
    betService.onBetChallengeReceived(handleBetChallengeReceived);
    betService.onBetChallengeResponse(handleBetChallengeResponse);
    betService.onBetChallengeExpired(handleBetChallengeExpired);
    betService.onBetChallengeCancelled(handleBetChallengeCancelled);
    betService.onPendingBetChallenges(handlePendingBetChallenges);
    betService.onBetResult(handleBetResult);
    betService.onBetGameReady(handleBetGameReady);
    return () => {
      betService.offBetChallengeReceived();
      betService.offBetChallengeResponse();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      betService.offPendingBetChallenges();
      betService.offBetResult(handleBetResult);
      betService.offBetGameReady();
    };
  }, [handleBetChallengeReceived, handleBetChallengeResponse, handleBetChallengeExpired, handleBetChallengeCancelled, handlePendingBetChallenges, handleBetResult, handleBetGameReady]);

  // Only fetch pending challenges when user/isConnected changes
  useEffect(() => {
    if (user && isConnected) {
      betService.getPendingBetChallenges();
    }
  }, [isConnected, user]);

  const acceptBetChallenge = useCallback((challengeId: string) => {
    if (!challengeId) {
      toastRef.current.error('Invalid challenge ID');
      return;
    }
    try {
      const challenge = pendingBetChallenges.find(c => c.id === challengeId) || 
                       (currentBetChallengeRef.current?.id === challengeId ? currentBetChallengeRef.current : null);
      if (!challenge) {
        toastRef.current.error('Challenge not found');
        return;
      }
      betService.respondToBetChallenge(challengeId, true);
      setCurrentBetChallenge(null);
      setIsShowingBetNotification(false);
      toastRef.current.success('Bet challenge accepted, setting up the game...');
      localStorage.setItem('activeBetChallengeId', challengeId);
      localStorage.setItem('activeBetType', challenge.betType);
      if (challenge.stakeAmount) {
        localStorage.setItem('activeBetStakeAmount', challenge.stakeAmount.toString());
      }
    } catch (error) {
      console.error('Error accepting bet challenge:', error);
      toastRef.current.error('Failed to accept challenge');
    }
  }, [pendingBetChallenges]);

  const rejectBetChallenge = useCallback((challengeId: string) => {
    const challengerName = currentBetChallengeRef.current?.challengerName || 
                           currentBetChallengeRef.current?.senderUsername || 
                           'Challenger';
    betService.respondToBetChallenge(challengeId, false);
    setIsShowingBetNotification(false);
    setCurrentBetChallenge(null);
    toastRef.current.info(`You declined ${challengerName}'s challenge`);
  }, []);

  const cancelBetChallenge = useCallback((betId: string) => {
    betService.cancelBetChallenge(betId);
  }, []);

  const sendBetChallenge = useCallback((options: {
    opponentId?: string;
    opponentSocketId?: string;
    betType: BetType;
    stakeAmount?: number;
    gameMode: string;
    timeControl: string;
    preferredSide: string;
  }) => {
    return betService.sendBetChallenge(options);
  }, []);

  // Memoize context value
  const contextValue = useMemo(() => ({
    pendingBetChallenges,
    currentBetChallenge,
    isShowingBetNotification,
    acceptBetChallenge,
    rejectBetChallenge,
    cancelBetChallenge,
    sendBetChallenge,
    currentBetResult,
  }), [pendingBetChallenges, currentBetChallenge, isShowingBetNotification, acceptBetChallenge, rejectBetChallenge, cancelBetChallenge, sendBetChallenge, currentBetResult]);

  return (
    <BetContext.Provider value={contextValue}>
      {children}
    </BetContext.Provider>
  );
}; 