'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface DisconnectionNotificationProps {
  gameId: string;
  playerId: string;
  reconnectTimeoutSeconds: number;
}

const DisconnectionNotification: React.FC<DisconnectionNotificationProps> = ({
  gameId,
  playerId,
  reconnectTimeoutSeconds,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(reconnectTimeoutSeconds);
  const { connectionStatus } = useSocket();
  const isOwnDisconnection = connectionStatus === 'disconnected';

  useEffect(() => {
    // Only count down if there's time remaining
    if (timeRemaining <= 0) return;

    const timerId = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeRemaining]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isOwnDisconnection) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
        <div className="bg-red-800 p-6 rounded-lg shadow-lg max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-white mb-4">Connection Lost</h2>
          <p className="text-white mb-4">
            You've been disconnected from the server. Attempting to reconnect...
          </p>
          <div className="text-2xl font-mono text-white mb-4">
            {formatTime(timeRemaining)}
          </div>
          <p className="text-white text-sm">
            If you don't reconnect in time, you may forfeit the game.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="bg-yellow-600 p-4 rounded-lg shadow-lg max-w-xs">
        <h3 className="text-lg font-bold text-white mb-2">Opponent Disconnected</h3>
        <p className="text-white text-sm mb-2">
          Your opponent has disconnected. Their clock is paused.
        </p>
        <div className="text-xl font-mono text-white text-center">
          {formatTime(timeRemaining)}
        </div>
        <p className="text-white text-xs mt-2">
          If they don't reconnect in time, you'll win the game.
        </p>
      </div>
    </div>
  );
};

export default DisconnectionNotification; 