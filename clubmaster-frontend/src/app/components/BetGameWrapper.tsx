"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBetGame } from '@/context/BetGameContext';
import { BetType } from '@/types/bet';

interface BetGameWrapperProps {
  children: React.ReactNode;
  gameId?: string;
  onGameEnd?: (isWinner: boolean, isDraw: boolean) => void;
}

export default function BetGameWrapper({ 
  children, 
  gameId,
  onGameEnd 
}: BetGameWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    setBetGameInfo, 
    isBetGame, 
    betType, 
    isWinner, 
    resetBetGameInfo 
  } = useBetGame();
  
  // Add a state to track if we've already processed the game end
  const [gameEndProcessed, setGameEndProcessed] = useState(false);
  
  // Add debug logging for the component
  useEffect(() => {
    console.log('[BetGameWrapper] Initializing with props:', { 
      gameId, 
      isBetGameContext: isBetGame,
      betTypeContext: betType
    });
    
    // Log URL parameters for debugging
    const isBetGameParam = searchParams.get('isBetGame');
    const betTypeParam = searchParams.get('betType');
    console.log('[BetGameWrapper] URL parameters:', { 
      isBetGameParam, 
      betTypeParam
    });
    
    // Log localStorage values for debugging
    const storedIsBetGame = localStorage.getItem('isBetGame');
    const storedBetType = localStorage.getItem('betType');
    console.log('[BetGameWrapper] localStorage values:', { 
      storedIsBetGame, 
      storedBetType
    });
    
    // Clean up any stale bet game data on mount
    // This helps prevent issues with previous bet games affecting new normal games
    if (storedIsBetGame !== 'true' && isBetGameParam !== 'true') {
      console.log('[BetGameWrapper] Not a bet game, cleaning up any stale bet data');
      resetBetGameInfo();
      localStorage.removeItem('betType');
      localStorage.removeItem('isBetGame');
      localStorage.removeItem('betId');
    }
  }, []);
  
  // Initialize bet game info from URL parameters or localStorage
  useEffect(() => {
    const isBetGameParam = searchParams.get('isBetGame') === 'true';
    const betTypeParam = searchParams.get('betType');
    const storedIsBetGame = localStorage.getItem('isBetGame') === 'true';
    const storedBetType = localStorage.getItem('betType');
    
    // Only set bet game info if this is actually a bet game
    // Use strict === true comparison to ensure we're dealing with a boolean true
    if ((isBetGameParam === true || storedIsBetGame === true) && (betTypeParam || storedBetType)) {
      // Use URL parameters first, fall back to localStorage
      const finalBetType = betTypeParam || storedBetType;
      
      console.log('[BetGameWrapper] Initializing bet game with:', {
        isBetGame: true,
        betType: finalBetType,
        gameId
      });
      
      // Validate bet type before setting
      if (finalBetType === 'PROFILE_CONTROL' || 
          finalBetType === 'PROFILE_LOCK' || 
          finalBetType === 'RATING_STAKE') {
        
        // Store values in localStorage for persistence
        localStorage.setItem('isBetGame', 'true');
        localStorage.setItem('betType', finalBetType);
        
        // Set in context - fix the format to match the expected interface
        setBetGameInfo({
          isBetGame: true,
          betType: finalBetType as BetType
        });
      } else {
        console.warn('[BetGameWrapper] Invalid bet type:', finalBetType);
      }
    } else {
      console.log('[BetGameWrapper] Not a bet game, resetting bet game info');
      // Reset bet game info to ensure we don't have stale data
      resetBetGameInfo();
    }
  }, [searchParams, setBetGameInfo, resetBetGameInfo]);
  
  // Handle game end and redirect to appropriate result page
  useEffect(() => {
    // Only process if we have a valid game result and haven't processed it yet
    if (isBetGame === true && betType && isWinner !== null && !gameEndProcessed) {
      console.log('[BetGameWrapper] Game ended, preparing to redirect to result page:', {
        isBetGame,
        betType,
        isWinner,
        gameId
      });
      
      // Mark as processed to prevent duplicate redirects
      setGameEndProcessed(true);
      
      // Determine which result page to navigate to
      let resultPath = '';
      
      // Only redirect to bet result pages if we have a valid bet type
      if (betType === BetType.PROFILE_CONTROL) {
        resultPath = '/bet/result/profile-control';
      } else if (betType === BetType.PROFILE_LOCK) {
        resultPath = '/bet/result/profile-lock';
      } else if (betType === BetType.RATING_STAKE) {
        resultPath = '/bet/result/rating-stake';
      } else {
        console.error('[BetGameWrapper] Invalid bet type for redirection:', betType);
        return;
      }
      
      // Add a short delay before redirecting to ensure all state updates are complete
      const redirectTimer = setTimeout(() => {
        console.log(`[BetGameWrapper] Redirecting to: ${resultPath}?result=${isWinner ? 'win' : 'loss'}`);
        router.push(`${resultPath}?result=${isWinner ? 'win' : 'loss'}`);
      }, 1000);
      
      // Clean up timer if component unmounts
      return () => clearTimeout(redirectTimer);
    }
  }, [isBetGame, betType, isWinner, router, gameEndProcessed]);
  
  // Call the parent's onGameEnd callback when we have a result
  useEffect(() => {
    if (onGameEnd && isWinner !== null && isBetGame === true) {
      console.log('[BetGameWrapper] Calling onGameEnd callback:', { 
        isWinner, 
        isDraw: false 
      });
      onGameEnd(isWinner, false);
    }
  }, [isWinner, onGameEnd, isBetGame]);
  
  return <>{children}</>;
} 