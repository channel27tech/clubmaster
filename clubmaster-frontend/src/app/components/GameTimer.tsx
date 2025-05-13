'use client';

import React, { useState, useEffect } from 'react';
import GameClock from './GameClock';
import * as socketService from '@/services/socketService';

interface GameTimerProps {
  gameId: string;
  timeControl: string;
  onTimeOut?: (player: 'white' | 'black') => void;
}

// Helper function to get initial time in seconds from time control string
const getInitialTimeInSeconds = (timeControlStr: string): number => {
  try {
    // Expected format: "3+0", "5+0", "10+0"
    const minutes = parseInt(timeControlStr.split('+')[0]);
    
    // Direct mapping for known values for reliability
    if (minutes === 3) return 180; // 3 minutes
    if (minutes === 5) return 300; // 5 minutes
    if (minutes === 10) return 600; // 10 minutes
    
    // Fallback calculation for other values
    return minutes * 60;
  } catch (error) {
    console.error('Error parsing time control:', error, 'timeControlStr:', timeControlStr);
    return 300; // Default to 5 minutes
  }
};

/**
 * GameTimer component to manage both players' clocks
 */
const GameTimer: React.FC<GameTimerProps> = ({
  gameId,
  timeControl,
  onTimeOut
}) => {
  // Initialize state with the correct time from timeControl prop
  const initialTime = getInitialTimeInSeconds(timeControl);
  const [whiteTime, setWhiteTime] = useState<number>(initialTime);
  const [blackTime, setBlackTime] = useState<number>(initialTime);
  const [isWhiteTurn, setIsWhiteTurn] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    // Reset timers when timeControl changes
    const newInitialTime = getInitialTimeInSeconds(timeControl);
    console.log('Initializing timers with time control:', timeControl, 'initial time:', newInitialTime);
    setWhiteTime(newInitialTime);
    setBlackTime(newInitialTime);
  }, [timeControl]);

  useEffect(() => {
    // Ensure we have a socket connection
    const socket = socketService.getSocket();
    
    console.log(`🎮 GameTimer initializing with gameId: ${gameId}, timeControl: ${timeControl}`);
    
    // Join game room
    socketService.joinGame({ gameType: 'chess' });

    // Initialize timer with the specified time control
    if (timeControl) {
      console.log(`⏱️ Calling initializeTimer with timeControl: ${timeControl}`);
      socketService.initializeTimer(gameId, timeControl);
    } else {
      console.error('❌ No timeControl provided to GameTimer');
    }
    
    // Listen for timer updates
    socket.on('timerUpdate', (data: {
      whiteTimeMs: number,
      blackTimeMs: number,
      isWhiteTurn: boolean,
      isRunning: boolean
    }) => {
      console.log('⏱️ Timer update received:', data);
      setWhiteTime(Math.ceil(data.whiteTimeMs / 1000));
      setBlackTime(Math.ceil(data.blackTimeMs / 1000));
      setIsWhiteTurn(data.isWhiteTurn);
      setIsRunning(data.isRunning);

      // Check for timeout
      if (data.whiteTimeMs <= 0) {
        onTimeOut?.('white');
      } else if (data.blackTimeMs <= 0) {
        onTimeOut?.('black');
      }
    });

    // Cleanup function
    return () => {
      socket.off('timerUpdate');
    };
  }, [gameId, timeControl, onTimeOut]);

  return (
    <div className="flex justify-between w-full max-w-lg mx-auto p-4">
      <GameClock
        time={whiteTime}
        isActive={isRunning && isWhiteTurn}
        label="White"
      />
      <GameClock
        time={blackTime}
        isActive={isRunning && !isWhiteTurn}
        label="Black"
      />
    </div>
  );
};

export default GameTimer; 