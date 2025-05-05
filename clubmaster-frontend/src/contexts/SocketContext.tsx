import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import * as socketService from '../services/socketService';

// Define the context type
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  joinGame: (gameOptions: { gameType: string }) => void;
  cancelMatchmaking: () => void;
  offerDraw: (gameId: string) => void;
  acceptDraw: (gameId: string) => void;
  declineDraw: (gameId: string) => void;
  resignGame: (gameId: string) => void;
  abortGame: (gameId: string) => void;
}

// Create the context with a default value
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
  connect: () => {},
  disconnect: () => {},
  joinGame: () => {},
  cancelMatchmaking: () => {},
  offerDraw: () => {},
  acceptDraw: () => {},
  declineDraw: () => {},
  resignGame: () => {},
  abortGame: () => {},
});

// Custom hook to use the socket context
export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

// Socket provider component
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Initialize socket connection
  const connect = () => {
    try {
      const socketInstance = socketService.getSocket();
      setSocket(socketInstance);
      
      // Update connection states based on socket events
      socketInstance.on('connect', () => {
        setIsConnected(true);
        setIsReconnecting(false);
      });
      
      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });
      
      socketInstance.on('reconnect_attempt', () => {
        setIsReconnecting(true);
      });
      
      socketInstance.on('reconnect', () => {
        setIsConnected(true);
        setIsReconnecting(false);
      });
      
      socketInstance.on('reconnect_failed', () => {
        setIsReconnecting(false);
      });
    } catch (error) {
      console.error('Error connecting to socket server:', error);
    }
  };

  // Disconnect socket
  const disconnect = () => {
    socketService.disconnectSocket();
    setSocket(null);
    setIsConnected(false);
    setIsReconnecting(false);
  };

  // Join a game
  const joinGame = (gameOptions: { gameType: string }) => {
    socketService.joinGame(gameOptions);
  };
  
  // Cancel matchmaking
  const cancelMatchmaking = () => {
    socketService.cancelMatchmaking();
  };

  // Offer a draw
  const offerDraw = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('offer_draw', { gameId });
    }
  };

  // Accept a draw offer
  const acceptDraw = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('accept_draw', { gameId });
    }
  };

  // Decline a draw offer
  const declineDraw = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('decline_draw', { gameId });
    }
  };

  // Resign from a game
  const resignGame = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('resign_game', { gameId });
    }
  };

  // Abort a game
  const abortGame = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('abort_game', { gameId });
    }
  };

  // Connect to the socket when the component mounts
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  // Value to be provided to consumers
  const value = {
    socket,
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    joinGame,
    cancelMatchmaking,
    offerDraw,
    acceptDraw,
    declineDraw,
    resignGame,
    abortGame,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}; 