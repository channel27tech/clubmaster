"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BetType } from '@/types/bet';

interface BetGameContextType {
  isBetGame: boolean;
  betType: BetType | null;
  betId: string | null;
  opponentId: string | null;
  isWinner: boolean | null;
  setBetGameInfo: (info: {
    isBetGame: boolean;
    betType?: BetType | null;
    betId?: string | null;
    opponentId?: string | null;
  }) => void;
  setGameResult: (isWinner: boolean) => void;
  resetBetGameInfo: () => void;
}

const BetGameContext = createContext<BetGameContextType | undefined>(undefined);

export const BetGameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isBetGame, setIsBetGame] = useState(false);
  const [betType, setBetType] = useState<BetType | null>(null);
  const [betId, setBetId] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);

  const setBetGameInfo = (info: {
    isBetGame: boolean;
    betType?: BetType | null;
    betId?: string | null;
    opponentId?: string | null;
  }) => {
    setIsBetGame(info.isBetGame);
    if (info.betType !== undefined) setBetType(info.betType);
    if (info.betId !== undefined) setBetId(info.betId);
    if (info.opponentId !== undefined) setOpponentId(info.opponentId);
  };

  const setGameResult = (gameIsWinner: boolean) => {
    setIsWinner(gameIsWinner);
  };

  const resetBetGameInfo = () => {
    setIsBetGame(false);
    setBetType(null);
    setBetId(null);
    setOpponentId(null);
    setIsWinner(null);
  };

  return (
    <BetGameContext.Provider
      value={{
        isBetGame,
        betType,
        betId,
        opponentId,
        isWinner,
        setBetGameInfo,
        setGameResult,
        resetBetGameInfo,
      }}
    >
      {children}
    </BetGameContext.Provider>
  );
};

export const useBetGame = () => {
  const context = useContext(BetGameContext);
  if (context === undefined) {
    throw new Error('useBetGame must be used within a BetGameProvider');
  }
  return context;
}; 