'use client';

import React, { useState, useEffect, useRef } from 'react';

interface GameClockProps {
  timeInSeconds: number;
  isActive: boolean;
  isDarkTheme?: boolean;
  onTimeOut?: () => void;
  playLowTimeSound?: () => void;
}

/**
 * GameClock component displays a chess game timer
 * Changes appearance when time falls below 1 minute
 * NOTE: Countdown functionality is currently disabled - timers remain static
 */
const GameClock: React.FC<GameClockProps> = ({
  timeInSeconds: initialTime,
  isActive,
  isDarkTheme = false,
  onTimeOut,
  playLowTimeSound
}) => {
  // State to track remaining time - using initial time directly now 
  // since we're disabling the countdown
  const [timeRemaining] = useState(initialTime);
  
  // Track if we've already played the low time sound
  const hasPlayedLowTimeSound = useRef(false);
  
  // Timer effect - disabled 
  // useEffect(() => {
  //   // Reset when initial time changes
  //   setTimeRemaining(initialTime);
  //   hasPlayedLowTimeSound.current = false;
  // }, [initialTime]);
  
  // Timer countdown effect - disabled
  // useEffect(() => {
  //   let interval: NodeJS.Timeout | null = null;
  //   
  //   if (isActive && timeRemaining > 0) {
  //     interval = setInterval(() => {
  //       setTimeRemaining((prevTime) => {
  //         // Check if time is about to run low
  //         if (prevTime === 60 && !hasPlayedLowTimeSound.current && playLowTimeSound) {
  //           playLowTimeSound();
  //           hasPlayedLowTimeSound.current = true;
  //         }
  //         
  //         // Check if time will run out on the next tick
  //         if (prevTime === 1 && onTimeOut) {
  //           onTimeOut();
  //         }
  //         
  //         return prevTime - 1;
  //       });
  //     }, 1000);
  //   } else if (timeRemaining === 0 && onTimeOut) {
  //     // If time is already at 0, call timeout handler
  //     onTimeOut();
  //   }
  //   
  //   return () => {
  //     if (interval) clearInterval(interval);
  //   };
  // }, [isActive, timeRemaining, onTimeOut, playLowTimeSound]);
  
  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if time is running low (less than 1 minute)
  const isTimeRunningLow = timeRemaining < 60;

  // Apply different styling based on theme (light/dark) and time status
  const textColor = isDarkTheme ? '#D9D9D9' : '#1F2323';
  const backgroundColor = isDarkTheme ? '#333939' : '#C8D5B9';
  
  // Add urgency indicator styles when time is low
  // Removed animation for static display
  const urgencyStyles = isTimeRunningLow ? {} : {};

  return (
    <div 
      className="font-mono flex items-center justify-center"
      style={{
        width: '81px',
        height: '36px',
        backgroundColor,
        color: isTimeRunningLow && isActive ? '#FF3333' : textColor,
        fontSize: '16px',
        fontWeight: isTimeRunningLow ? 'bold' : 'normal',
        borderRadius: '4px',
        ...urgencyStyles
      }}
    >
      {formatTime(timeRemaining)}
      
      {/* Pulse animation removed since we're making timers static */}
    </div>
  );
};

export default GameClock; 