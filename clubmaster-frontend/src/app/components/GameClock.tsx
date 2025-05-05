'use client';

import React from 'react';

interface GameClockProps {
  timeInSeconds: number;
  isActive: boolean;
  isDarkTheme?: boolean;
}

/**
 * GameClock component displays a chess game timer
 * Changes appearance when time falls below 1 minute
 */
const GameClock: React.FC<GameClockProps> = ({
  timeInSeconds,
  isActive,
  isDarkTheme = false
}) => {
  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if time is running low (less than 1 minute)
  const isTimeRunningLow = timeInSeconds < 60;

  // Apply different styling based on theme (light/dark) and time status
  const textColor = isDarkTheme ? '#D9D9D9' : '#1F2323';
  const backgroundColor = isDarkTheme ? '#333939' : '#C8D5B9';
  
  // Add urgency indicator styles when time is low
  const urgencyStyles = isTimeRunningLow ? {
    animation: isActive ? 'pulse 1s infinite' : 'none'
  } : {};

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
      {formatTime(timeInSeconds)}
      
      {/* Add global CSS for pulse animation */}
      {isTimeRunningLow && (
        <style jsx global>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
          }
        `}</style>
      )}
    </div>
  );
};

export default GameClock; 