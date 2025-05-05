'use client';

import React, { useState, useEffect } from 'react';
import GameClock from './GameClock';
import { socketService } from '../services/socket.service';

interface GameTimerProps {
  gameId: string;
  timeControl: 'BULLET' | 'BLITZ' | 'RAPID';
  onTimeOut?: (player: 'white' | 'black') => void;
}

/**
 * GameTimer component to manage both players' clocks
 */
const GameTimer: React.FC<GameTimerProps> = ({
  gameId,
  timeControl,
  onTimeOut
}) => {
  const [whiteTime, setWhiteTime] = useState<number>(0);
  const [blackTime, setBlackTime] = useState<number>(0);
  const [isWhiteTurn, setIsWhiteTurn] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    const socket = socketService.connect();

    // Join game room and initialize timer
    socketService.joinGame(gameId);
    socketService.initializeTimer(gameId, timeControl);

    // Listen for timer updates
    socket.on('timerUpdate', (data: {
      whiteTimeMs: number,
      blackTimeMs: number,
      isWhiteTurn: boolean,
      isRunning: boolean
    }) => {
      setWhiteTime(Math.ceil(data.whiteTimeMs / 1000));
      setBlackTime(Math.ceil(data.blackTimeMs / 1000));
      setIsWhiteTurn(data.isWhiteTurn);
      setIsRunning(data.isRunning);
    });

    // Listen for game timeout
    socket.on('gameTimeout', (data: { winner: 'white' | 'black' }) => {
      if (onTimeOut) {
        onTimeOut(data.winner === 'white' ? 'black' : 'white');
      }
    });

    // Get initial timer state
    socketService.getTimerState(gameId);

    // Cleanup on unmount
    return () => {
      socket.off('timerUpdate');
      socket.off('gameTimeout');
      socketService.leaveGame(gameId);
    };
  }, [gameId, timeControl, onTimeOut]);
  
  return (
    <div className="flex flex-col gap-2">
      {/* Black Player Clock */}
      <GameClock 
        timeInSeconds={blackTime}
        isActive={isRunning && !isWhiteTurn}
        isDarkTheme={false}
      />
      
      {/* White Player Clock */}
      <GameClock 
        timeInSeconds={whiteTime}
        isActive={isRunning && isWhiteTurn}
        isDarkTheme={true}
      />
    </div>
  );
};

export default GameTimer; 