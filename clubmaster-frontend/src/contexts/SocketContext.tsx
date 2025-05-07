import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

// Define connection status type
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// Define the context type
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionStatus: ConnectionStatus;
  reconnectionAttempts: number;
  disconnectionDuration: number | null;
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
  rejoinGame: (gameId: string, playerId: string) => void;
  manualReconnect: () => void;
}

// Create the context with a default value
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
  connectionStatus: 'disconnected',
  reconnectionAttempts: 0,
  disconnectionDuration: null,
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
  rejoinGame: () => {},
  manualReconnect: () => {},
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectionAttempts, setReconnectionAttempts] = useState<number>(0);
  const [disconnectionDuration, setDisconnectionDuration] = useState<number | null>(null);
  
  // Use refs for tracking disconnection time
  const disconnectionStartTimeRef = useRef<number | null>(null);
  const disconnectionTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  
  // Start tracking disconnection time
  const startDisconnectionTimer = () => {
    disconnectionStartTimeRef.current = Date.now();
    
    // Update disconnection duration every second
    disconnectionTimerRef.current = setInterval(() => {
      if (disconnectionStartTimeRef.current) {
        const duration = Math.floor((Date.now() - disconnectionStartTimeRef.current) / 1000);
        setDisconnectionDuration(duration);
      }
    }, 1000);
  };

  // Stop tracking disconnection time
  const stopDisconnectionTimer = () => {
    if (disconnectionTimerRef.current) {
      clearInterval(disconnectionTimerRef.current);
      disconnectionTimerRef.current = null;
    }
    disconnectionStartTimeRef.current = null;
    setDisconnectionDuration(null);
  };

  // Reset reconnection attempts counter
  const resetReconnectionAttempts = () => {
    setReconnectionAttempts(0);
  };

  // Initialize socket connection
  const connect = () => {
    try {
      setConnectionStatus('connecting');
      const socketInstance = socketService.getSocket({
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000
      });
      
      setSocket(socketInstance);
      
      // Update connection states based on socket events
      socketInstance.on('connect', () => {
        setIsConnected(true);
        setIsReconnecting(false);
        setConnectionStatus('connected');
        stopDisconnectionTimer();
        resetReconnectionAttempts();
      });
      
      socketInstance.on('disconnect', (reason) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        startDisconnectionTimer();
        console.log(`Socket disconnected due to: ${reason}`);
      });
      
      socketInstance.on('reconnect_attempt', (attemptNumber) => {
        setIsReconnecting(true);
        setConnectionStatus('connecting');
        setReconnectionAttempts(attemptNumber);
        console.log(`Reconnection attempt #${attemptNumber}`);
      });
      
      socketInstance.on('reconnect', (attemptNumber) => {
        setIsConnected(true);
        setIsReconnecting(false);
        setConnectionStatus('connected');
        stopDisconnectionTimer();
        resetReconnectionAttempts();
        console.log(`Reconnected after ${attemptNumber} attempts`);
      });
      
      socketInstance.on('reconnect_failed', () => {
        setIsReconnecting(false);
        setConnectionStatus('disconnected');
        console.error('Reconnection failed after all attempts');
      });
      
      socketInstance.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
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
      setConnectionStatus('disconnected');
    }
  };

  // Manually trigger reconnection
  const manualReconnect = () => {
    if (socket) {
      socket.connect();
      setConnectionStatus('connecting');
    } else {
      connect();
    }
  };

  // Disconnect socket
  const disconnect = () => {
    socketService.disconnectSocket();
    setSocket(null);
    setIsConnected(false);
    setIsReconnecting(false);
    resetGameEnd();
    setConnectionStatus('disconnected');
    stopDisconnectionTimer();
    resetReconnectionAttempts();
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
  
  // Rejoin a game after reconnection
  const rejoinGame = (gameId: string, playerId: string) => {
    if (socket?.connected) {
      socket.emit('rejoin_game', { gameId, playerId });
      console.log(`Attempting to rejoin game ${gameId}`);
    } else {
      console.warn('Cannot rejoin game: socket not connected');
    }
  };

  // Connect to the socket when the component mounts
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      if (disconnectionTimerRef.current) {
        clearInterval(disconnectionTimerRef.current);
      }
      disconnect();
    };
  }, []);

  // Value to be provided to consumers
  const value = {
    socket,
    isConnected,
    isReconnecting,
    connectionStatus,
    reconnectionAttempts,
    disconnectionDuration,
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
    rejoinGame,
    manualReconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}; 