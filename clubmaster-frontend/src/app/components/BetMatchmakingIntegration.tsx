'use client';

import React, { useRef, useEffect } from 'react';
import { useBet } from '@/context/BetContext';
import { useRouter } from 'next/navigation';
import MatchmakingManager, { MatchmakingManagerHandle } from './MatchmakingManager';
import { useToast } from '@/hooks/useToast';
import { BetType } from '@/types/bet';

interface BetMatchmakingIntegrationProps {
  onError?: (error: string) => void;
}

/**
 * BetMatchmakingIntegration component
 * Integrates bet challenges with the matchmaking system
 */
const BetMatchmakingIntegration: React.FC<BetMatchmakingIntegrationProps> = ({ onError }) => {
  const matchmakingRef = useRef<MatchmakingManagerHandle>(null);
  const { currentBetChallenge, acceptBetChallenge } = useBet();
  const router = useRouter();
  const toast = useToast();

  // Handle bet challenge acceptance
  const handleAcceptBetChallenge = (betChallengeId: string, gameMode: string, timeControl: string, preferredSide: string) => {
    // First accept the bet challenge through the bet service
    acceptBetChallenge(betChallengeId);

    // Then start matchmaking with the bet challenge ID
    if (matchmakingRef.current) {
      toast.info('Starting matchmaking for bet challenge...');
      
      matchmakingRef.current.startMatchmaking(
        gameMode,
        timeControl.split('+')[0], // Extract minutes part
        preferredSide,
        {
          betChallengeId: betChallengeId
        }
      );
    } else {
      toast.error('Failed to start matchmaking for bet challenge');
      if (onError) {
        onError('Failed to start matchmaking for bet challenge');
      }
    }
  };

  // Function to create a new bet challenge and start matchmaking
  const createBetChallengeAndStartMatchmaking = (
    opponentId: string,
    betType: BetType,
    stakeAmount: number | undefined,
    gameMode: string,
    timeControl: string,
    preferredSide: string
  ) => {
    // This function would be called from a bet challenge creation form
    // It would create a bet challenge and then start matchmaking
    // Implementation depends on how bet challenges are created in your app
  };

  // Handle game found event
  const handleGameFound = (gameId: string) => {
    toast.success(`Game found! Redirecting to game ${gameId}`);
    router.push(`/play/game/${gameId}`);
  };

  // Handle errors
  const handleError = (errorMessage: string) => {
    toast.error(`Error: ${errorMessage}`);
    if (onError) {
      onError(errorMessage);
    }
  };

  return (
    <MatchmakingManager 
      ref={matchmakingRef}
      onError={handleError}
      onGameFound={handleGameFound}
    />
  );
};

export default BetMatchmakingIntegration; 