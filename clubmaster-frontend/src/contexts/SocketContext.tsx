import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import * as socketService from '../services/socketService';
import { GameEndReason, GameResultType } from '../app/utils/types';

// Define the game end data interface
interface GameEndData {
  winner: 'you' | 'opponent' | 'draw';
  reason: GameEndReason;
  playerName: string;
  opponentName: string;
  playerRating: number;
  opponentRating: number;
  playerRatingChange: number;
  opponentRatingChange: number;
  gameId?: string;
}

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
  gameEnded: boolean;
  gameEndData: GameEndData | null;
  resetGameEnd: () => void;
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
  gameEnded: false,
  gameEndData: null,
  resetGameEnd: () => {},
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
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [gameEndData, setGameEndData] = useState<GameEndData | null>(null);

  // Process game end event data
  const processGameEndEvent = (data: any, reason: GameEndReason, winner: 'you' | 'opponent' | 'draw') => {
    console.log('Game ended:', { reason, winner, data });
    
    const processedData: GameEndData = {
      winner: winner,
      reason: reason,
      playerName: data?.playerName || 'You',
      opponentName: data?.opponentName || 'Opponent',
      playerRating: data?.playerRating || 1500,
      opponentRating: data?.opponentRating || 1500,
      playerRatingChange: data?.playerRatingChange || (winner === 'you' ? 10 : (winner === 'opponent' ? -10 : 0)),
      opponentRatingChange: data?.opponentRatingChange || (winner === 'opponent' ? 10 : (winner === 'you' ? -10 : 0)),
      gameId: data?.gameId
    };

    setGameEndData(processedData);
    setGameEnded(true);
  };

  // Reset game end state
  const resetGameEnd = () => {
    setGameEnded(false);
    setGameEndData(null);
  };

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

      // Generic game end event
      socketInstance.on('game_end', (data) => {
        const winner = data.winner === 'player' ? 'you' : 
                      data.winner === 'opponent' ? 'opponent' : 'draw';
        const reason = data.reason || 'checkmate';
        processGameEndEvent(data, reason as GameEndReason, winner);
      });
      
      // Specific game end events
      socketInstance.on('checkmate', (data) => {
        processGameEndEvent(data, 'checkmate', data.winner === 'player' ? 'you' : 'opponent');
      });
      
      socketInstance.on('timeout', (data) => {
        processGameEndEvent(data, 'timeout', data.winner === 'player' ? 'you' : 'opponent');
      });
      
      socketInstance.on('resignation', (data) => {
        processGameEndEvent(data, 'resignation', data.winner === 'player' ? 'you' : 'opponent');
      });
      
      socketInstance.on('draw_agreement', (data) => {
        processGameEndEvent(data, 'draw_agreement', 'draw');
      });
      
      socketInstance.on('stalemate', (data) => {
        processGameEndEvent(data, 'stalemate', 'draw');
      });
      
      socketInstance.on('insufficient_material', (data) => {
        processGameEndEvent(data, 'insufficient_material', 'draw');
      });
      
      socketInstance.on('threefold_repetition', (data) => {
        processGameEndEvent(data, 'threefold_repetition', 'draw');
      });
      
      socketInstance.on('fifty_move_rule', (data) => {
        processGameEndEvent(data, 'fifty_move_rule', 'draw');
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
    resetGameEnd();
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
    gameEnded,
    gameEndData,
    resetGameEnd,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}; 