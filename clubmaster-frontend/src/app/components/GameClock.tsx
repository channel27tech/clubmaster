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
  onTimeOut
}) => {
  const [remainingTime, setRemainingTime] = useState(timeInSeconds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledTimeOut = useRef(false);

  useEffect(() => {
    // Reset the timer when we get a new initial time
    setRemainingTime(timeInSeconds);
    hasCalledTimeOut.current = false;
  }, [timeInSeconds]);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // If active and time is greater than 0, start the timer
    if (isActive && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prevTime => {
          const newTime = prevTime - 1;
          
          // If time reaches zero, clear interval and call onTimeOut
          if (newTime <= 0 && !hasCalledTimeOut.current) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // Call onTimeOut callback if provided
            if (onTimeOut) {
              hasCalledTimeOut.current = true;
              onTimeOut();
            }
            
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    }

    // Clean up timer on unmount or when isActive changes
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, onTimeOut]);

  playLowTimeSound
}) => {
  // Track if we've already played the low time sound
  const hasPlayedLowTimeSound = useRef(false);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if time is running low (less than 1 minute)
  const isTimeRunningLow = remainingTime < 60;


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
      {formatTime(remainingTime)}
      
      {/* Pulse animation removed since we're making timers static */}
    </div>
  );
};

export default GameClock; 