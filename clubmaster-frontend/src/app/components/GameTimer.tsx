'use client';

import React, { useState, useEffect } from 'react';
import GameClock from './GameClock';

interface GameTimerProps {
  initialWhiteTime: number; // Time in seconds
  initialBlackTime: number; // Time in seconds
  activePlayer?: 'white' | 'black' | null;
  onTimeOut?: (player: 'white' | 'black') => void;
}

/**
 * GameTimer component to manage both players' clocks
 */
const GameTimer: React.FC<GameTimerProps> = ({
  initialWhiteTime,
  initialBlackTime,
  activePlayer = null,
  onTimeOut
}) => {
  const [whiteTime, setWhiteTime] = useState(initialWhiteTime);
  const [blackTime, setBlackTime] = useState(initialBlackTime);
  
  // Countdown effect for active player
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (activePlayer) {
      timer = setInterval(() => {
        if (activePlayer === 'white') {
          setWhiteTime(prev => {
            if (prev <= 1 && onTimeOut) {
              onTimeOut('white');
              clearInterval(timer as NodeJS.Timeout);
              return 0;
            }
            return prev - 1;
          });
        } else {
          setBlackTime(prev => {
            if (prev <= 1 && onTimeOut) {
              onTimeOut('black');
              clearInterval(timer as NodeJS.Timeout);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activePlayer, onTimeOut]);
  
  return (
    <div className="flex flex-col gap-2">
      {/* Black Player Clock */}
      <GameClock 
        timeInSeconds={blackTime}
        isActive={activePlayer === 'black'}
        isDarkTheme={false}
      />
      
      {/* White Player Clock */}
      <GameClock 
        timeInSeconds={whiteTime}
        isActive={activePlayer === 'white'}
        isDarkTheme={true}
      />
    </div>
  );
};

export default GameTimer; 