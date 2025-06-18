'use client';

import React, { useState, useEffect, useRef } from 'react';

interface GameClockProps {
  timeInSeconds: number;
  isActive: boolean;
  isDarkTheme?: boolean;
  onTimeOut?: () => void;
  playLowTimeSound?: () => void;
  onTimeUpdate?: (newTime: number) => void;
}

/**
 * GameClock component displays a chess game timer
 * Changes appearance when time falls below 1 minute
 */
const GameClock: React.FC<GameClockProps> = ({
  timeInSeconds: initialTime,
  isActive,
  isDarkTheme = false,
  onTimeOut,
  playLowTimeSound,
  onTimeUpdate
}) => {
  const [remainingTime, setRemainingTime] = useState(initialTime);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledTimeOut = useRef(false);
  const hasPlayedLowTimeSound = useRef(false);
  const isMountedRef = useRef(true); // Track if component is mounted
  const isActiveRef = useRef(isActive); // Track isActive changes
  const lastInitialTimeRef = useRef(initialTime); // Track initial time changes
  
  // Use a ref to track when callbacks should be called
  const isTimeOutRef = useRef(false);
  const shouldPlaySoundRef = useRef(false);

  // Only update the remainingTime state when initialTime changes AND it's different from our last value
  // This prevents resetting the clock when the component re-renders with the same initialTime
  useEffect(() => {
    if (initialTime !== lastInitialTimeRef.current) {
      console.log(`[GameClock] initialTime changed from ${lastInitialTimeRef.current} to ${initialTime}`);
      setRemainingTime(initialTime);
      lastInitialTimeRef.current = initialTime;
      hasCalledTimeOut.current = false;
      hasPlayedLowTimeSound.current = false;
      isTimeOutRef.current = false;
      shouldPlaySoundRef.current = false;
    }
  }, [initialTime]);

  // Sync remainingTime with parent component via onTimeUpdate, but only when the value actually changes
  // This prevents the "setState during render" error
  const prevTimeRef = useRef(remainingTime);
  useEffect(() => {
    // Only call onTimeUpdate when remainingTime actually changes and not during initial render
    if (prevTimeRef.current !== remainingTime && onTimeUpdate) {
      prevTimeRef.current = remainingTime;
      onTimeUpdate(remainingTime);
    }
  }, [remainingTime, onTimeUpdate]);

  // Log when isActive changes
  useEffect(() => {
    console.log(`[GameClock] isActive changed to ${isActive}, remainingTime=${remainingTime}`);
    isActiveRef.current = isActive;
    
    // Clear any existing timer when isActive changes
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log(`[GameClock] Cleared timer due to isActive change to ${isActive}`);
    }
    
    // Start a new timer if this clock is now active
    if (isActive && remainingTime > 0) {
      console.log(`[GameClock] Starting new timer, remainingTime=${remainingTime}`);
      timerRef.current = setInterval(() => {
        if (isMountedRef.current && isActiveRef.current) {
          setRemainingTime((prevTime: number) => {
            const newTime = prevTime - 1;
            
            // Check if time is about to run low
            if (newTime === 60 && !hasPlayedLowTimeSound.current) {
              shouldPlaySoundRef.current = true;
            }
            
            // If time reaches zero, clear interval and mark for timeout
            if (newTime <= 0 && !hasCalledTimeOut.current) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              
              // Mark for timeout instead of calling directly
              isTimeOutRef.current = true;
              return 0;
            }
            
            return newTime;
          });
        }
      }, 1000);
    }
  }, [isActive, remainingTime]);

  // Handle time out in a separate effect to avoid state updates during render
  useEffect(() => {
    if (isTimeOutRef.current && !hasCalledTimeOut.current && onTimeOut) {
      hasCalledTimeOut.current = true;
      onTimeOut();
      isTimeOutRef.current = false;
    }
  }, [remainingTime, onTimeOut]);
  
  // Handle low time sound in a separate effect
  useEffect(() => {
    if (shouldPlaySoundRef.current && !hasPlayedLowTimeSound.current && playLowTimeSound) {
      hasPlayedLowTimeSound.current = true;
      playLowTimeSound();
      shouldPlaySoundRef.current = false;
    }
  }, [remainingTime, playLowTimeSound]);

  // Set up mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if time is running low (less than 1 minute)
  const isTimeRunningLow = remainingTime < 60;

  // Apply different styling based on theme (light/dark) and time status
  const backgroundColor = !isDarkTheme ? '#C8D5B9' : '#333939';
  const textColor = !isDarkTheme ? '#1F2323' : '#D9D9D9';

  return (
    <div 
      className="font-roboto font-[500] text-[16px] tracking-[.15em] flex items-center justify-center rounded-[4px]"
      style={{
        width: '81px',
        height: '36px',
        backgroundColor,
        color: isTimeRunningLow && isActive ? '#FF3333' : textColor,
      }}
    >
      {formatTime(remainingTime)}
    </div>
  );
};

export default GameClock; 