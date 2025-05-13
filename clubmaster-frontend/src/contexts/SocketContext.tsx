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
    
    // For resignations, ensure explicit handling by result and add extra safety
    if (reason === 'resignation') {
      // Log all values for debugging
      console.log('RESIGNATION HANDLING - detailed data:', {
        winner,
        reason,
        socketId: socket?.id,
        winnerSocketId: data.winnerSocketId || data.winnerId || data.winner,
        loserSocketId: data.loserSocketId || data.loserId || data.loser,
        explicitResult: data.result
      });
      
      // Safety check: NEVER allow draw for resignations
      if (winner === 'draw') {
        console.warn('CRITICAL: Resignation result was "draw" - forcing to "opponent" (loss)');
        winner = 'opponent'; // Default to loss if somehow marked as draw
      }
    }
    
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

    // Dispatch a custom event for components to listen to
    try {
      // Map our internal winner format to GameResultType format
      let resultType: GameResultType = 
        winner === 'you' ? 'win' : 
        winner === 'opponent' ? 'loss' : 'draw';
      
      const customEvent = new CustomEvent('game_ended', {
        detail: {
          winner: winner,
          reason: reason,
          result: resultType,
          // Include necessary IDs to resolve winner/loser
          winnerSocketId: data.winnerSocketId || data.winnerId || data.winner,
          loserSocketId: data.loserSocketId || data.loserId || data.loser,
          // Include all original data for maximum context
          ...data
        }
      });
      
      console.log('Dispatching game_ended event:', customEvent.detail);
      window.dispatchEvent(customEvent);
      
      console.log(`Successfully dispatched game_ended with result: ${resultType}`);
    } catch (err) {
      console.error('Error dispatching game_ended event:', err);
    }
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
        console.log('RECEIVED GENERIC game_end EVENT:', data);
        
        // Enhance with additional handling for resignation events
        if (data.reason === 'resignation') {
          // Check if we have explicit winner/loser IDs
          const mySocketId = socketInstance.id;
          const winnerSocketId = data.winnerSocketId || data.winnerId || data.winner;
          const loserSocketId = data.loserSocketId || data.loserId || data.loser;
          
          console.log('SOCKET ID COMPARISON FOR RESIGNATION game_end:', {
            mySocketId,
            winnerSocketId,
            loserSocketId,
            explicitResult: data.result // Check for explicit result field
          });
          
          // If we have an explicit result from the server, use it
          if (data.result === 'win' || data.result === 'loss') {
            console.log('Using server-provided explicit result:', data.result);
            const winner = data.result === 'win' ? 'you' : 'opponent';
            processGameEndEvent(data, 'resignation', winner);
            return;
          }
          
          // If we have valid socket IDs, use them to determine the winner
          if (winnerSocketId && loserSocketId) {
            const winner = mySocketId === winnerSocketId ? 'you' : 
                          mySocketId === loserSocketId ? 'opponent' : 'draw';
            processGameEndEvent(data, 'resignation', winner);
            return;
          }
        }
        
        // Fall back to generic handling for other cases
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
      
      // Add gameResigned event handler
      socketInstance.on('gameResigned', (data) => {
        console.log('========= RECEIVED gameResigned EVENT =========');
        console.log('Raw gameResigned payload:', JSON.stringify(data));
        
        // Determine winner/loser status using all available information
        const mySocketId = socketInstance.id;
        
        // Check for explicit winner/loser IDs with multiple fallbacks
        const winnerSocketId = data.winner || data.winnerSocketId || data.winnerId;
        const loserSocketId = data.loser || data.loserSocketId || data.loserId;
        
        // Check for direct match with my socket ID
        const isWinner = mySocketId === winnerSocketId;
        const isLoser = mySocketId === loserSocketId;
        
        // Check explicit flags
        const isResigning = data.resigning === true;
        const explicitResult = data.result; // Check if server sent an explicit result
        
        console.log('Socket ID comparison for gameResigned:', {
          mySocketId,
          winnerSocketId,
          loserSocketId,
          isWinner,
          isLoser,
          isResigning,
          explicitResult
        });
        
        // Default result - will be overridden if we have better information
        let finalResult: 'you' | 'opponent' | 'draw' = 'opponent'; // For resignations, default to loss
        
        // If we have an explicit result from the server, use it
        if (explicitResult === 'win' || explicitResult === 'loss' || explicitResult === 'draw') {
          console.log('Using server-provided explicit result:', explicitResult);
          finalResult = explicitResult === 'win' ? 'you' : 
                       explicitResult === 'loss' ? 'opponent' : 'draw';
        }
        // If socket IDs match, use that match
        else if (isWinner || isLoser) {
          console.log('Using socket ID match for winner/loser determination');
          finalResult = isWinner ? 'you' : 'opponent';
        }
        // If this client is the resigning player, they always lose
        else if (isResigning) {
          console.log('This client is the resigning player - marking as loss');
          finalResult = 'opponent'; // "opponent" means the opponent won, so the current player lost
        }
        // Last resort fallback with warning when we can't determine winner/loser
        else {
          console.warn('WARNING: Cannot reliably determine winner/loser from socket IDs', {
            mySocketId,
            winnerSocketId,
            loserSocketId,
            rawData: JSON.stringify(data)
          });
          
          // For resignations, NEVER default to draw
          // Instead, check if there's any indication this is the resigning player
          if (data.isResigningPlayer || data.resigner === mySocketId) {
            console.log('Detected resigning player from additional fields');
            finalResult = 'opponent'; // Current player loses
          } else {
            // If we're still not sure, log an error but maintain the default "opponent" (loss)
            console.error('CRITICAL ERROR: Cannot determine winner/loser reliably - defaulting to loss');
          }
        }
        
        // Process the game end event with our determined result
        processGameEndEvent(data, 'resignation', finalResult);
        
        // Always force both players to show game result screen by dispatching an event
        // This is crucial - even if the server event is correctly received but not processed,
        // this will ensure the UI shows the result
        if (typeof window !== 'undefined') {
          console.log('FORCE DISPATCHING game_ended event for resignation');
          try {
            // Important: Never default to 'draw' for resignations
            // Map our internal result to the game_ended event format
            let resultType: GameResultType = 
              finalResult === 'you' ? 'win' : 
              finalResult === 'opponent' ? 'loss' : 'draw';
            
            // Log what we're dispatching
            console.log(`Dispatching game_ended event with result: ${resultType}`);
            
            window.dispatchEvent(new CustomEvent('game_ended', { 
              detail: { 
                reason: 'resignation',
                result: resultType,
                timestamp: Date.now(), 
                source: 'socketContext',
                winnerSocketId, 
                loserSocketId
              } 
            }));
            
            // Set a backup timer to ensure the result screen appears
            setTimeout(() => {
              console.log('BACKUP: Dispatching secondary game_ended event after timeout');
              window.dispatchEvent(new CustomEvent('game_ended', { 
                detail: { 
                  reason: 'resignation',
                  result: resultType,
                  timestamp: Date.now(),
                  source: 'socketContext-backup',
                  winnerSocketId, 
                  loserSocketId
                } 
              }));
            }, 1000);
          } catch (error) {
            console.error('Error dispatching game_ended event:', error);
          }
        }
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
      
      // Add explicit handler for game_aborted
      socketInstance.on('game_aborted', (data) => {
        console.log('⚠️ game_aborted event received directly in socket init:', data);
        // The detailed handling is done in another useEffect, this is just for debugging
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

  // Resign from a game
  const resignGame = (gameId: string) => {
    if (!socket) return;
    
    try {
      console.log('Resigning game with ID:', gameId);
      
      // First, dispatch local event to immediately update UI
      const localGameEndEvent = new CustomEvent('game_ended', {
        detail: {
          reason: 'resignation',
          result: 'loss',  // Player who resigns always loses
          loserSocketId: socket.id, // Mark self as loser
          source: 'local_resign_event'
        }
      });
      window.dispatchEvent(localGameEndEvent);
      
      // Then, emit to server
      socket.emit('resign', { gameId });
      
      // Also process local state update
      processGameEndEvent(
        { gameId, loserSocketId: socket.id }, 
        'resignation', 
        'opponent' // When user resigns, opponent wins
      );
      
      console.log('Resignation processed');
    } catch (error) {
      console.error('Error during resignation:', error);
    }
  };

  // Abort a game
  const abortGame = (gameId: string) => {
    if (socket?.connected) {
      console.log(`Emitting abort_game event for gameId: ${gameId}`);
      socket.emit('abort_game', { gameId });
      
      // Add listener for abort response
      socket.once('abortGameResponse', (response: any) => {
        console.log('Received abortGameResponse:', response);
        
        if (response.data.success) {
          console.log('Abort game request successful');
        } else {
          console.error('Abort game request failed:', response.data.message);
        }
      });
    } else {
      console.error('Cannot abort game: socket not connected');
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

  // Listen for game events like game end, moves, etc.
  useEffect(() => {
    if (!socket) return;
    
    // Add more detailed info on game_state events 
    const originalOn = socket.on;
    socket.on = function(event: string, handler: (...args: any[]) => void) {
      if (event === 'game_state') {
        const enhancedHandler = (data: any) => {
          console.log('SOCKET RECEIVED game_state with data:', JSON.stringify(data));
          console.log('hasWhiteMoved in game_state event:', data.hasWhiteMoved);
          return handler(data);
        };
        return originalOn.call(this, event, enhancedHandler);
      }
      
      return originalOn.call(this, event, handler);
    };
    
    // Listen for game state updates
    const handleGameState = (data: any) => {
      console.log('Game state received:', data);
      
      // If the game state includes hasWhiteMoved, update our local state tracking
      if (data.hasWhiteMoved !== undefined) {
        // You could trigger a game state update here or use a ref to track this
        console.log('Setting hasWhiteMoved to:', data.hasWhiteMoved);
        
        // Notify other components via a custom event that they can listen for
        const gameStateEvent = new CustomEvent('game_state_updated', { 
          detail: { 
            hasWhiteMoved: data.hasWhiteMoved,
            isWhiteTurn: data.isWhiteTurn,
            hasStarted: data.hasStarted,
            isGameOver: data.isGameOver
          } 
        });
        window.dispatchEvent(gameStateEvent);
      }
    };
    
    // Listen for game abort event
    const handleGameAborted = (data: any) => {
      console.log('Game aborted event received:', data);
      
      // Extract player names from the more detailed data
      let playerName = 'You';
      let opponentName = 'Opponent';
      
      // If we have player information in the data
      if (data.players && Array.isArray(data.players)) {
        // Find initiator and non-initiator
        const initiator = data.players.find((p: any) => p.isInitiator);
        const nonInitiator = data.players.find((p: any) => !p.isInitiator);
        
        // Determine if current player is the initiator
        const isCurrentPlayerInitiator = data.isInitiator;
        
        if (isCurrentPlayerInitiator) {
          playerName = initiator?.username || 'You';
          opponentName = nonInitiator?.username || 'Opponent';
        } else {
          playerName = nonInitiator?.username || 'You';
          opponentName = initiator?.username || 'Opponent';
        }
      } else if (data.playerName && data.opponentName) {
        // Use the directly provided names
        playerName = data.playerName;
        opponentName = data.opponentName;
      }
      
      // Create game end data for aborted game - no ratings are affected
      const abortData = {
        gameId: data.gameId,
        playerName,
        opponentName,
        playerRating: 1500,
        opponentRating: 1500,
        playerRatingChange: 0, // No rating change on abort
        opponentRatingChange: 0  // No rating change on abort
      };
      
      // Process as a draw with abort reason
      processGameEndEvent(abortData, 'abort', 'draw');
      
      // Manual navigation to result page
      if (typeof window !== 'undefined') {
        // Wait a moment to ensure state updates first
        setTimeout(() => {
          // Dispatch a custom event for components to detect game end
          window.dispatchEvent(new CustomEvent('game_ended', { 
            detail: { 
              reason: 'abort',
              result: 'draw'
            } 
          }));
        }, 500);
      }
    };
    
    // Add event listeners for game_state and game_aborted
    socket.on('game_state', handleGameState);
    socket.on('game_aborted', handleGameAborted);
    
    // Clean up event listeners when component unmounts or socket changes
    return () => {
      socket.off('game_state', handleGameState);
      socket.off('game_aborted', handleGameAborted);
      
      // Restore original socket.on method
      if (socket) {
        socket.on = originalOn;
      }
    };
  }, [socket]);

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

  // Add manual logging for the enter_game event emission
  useEffect(() => {
    if (!socket) return;
    
    const originalEmit = socket.emit;
    socket.emit = function(...args) {
      const [event, ...rest] = args;
      if (event === 'enter_game') {
        console.log('Emitting enter_game with data:', rest[0]);
      }
      return originalEmit.apply(this, args);
    };

    // Cleanup on unmount
    return () => {
      socket.emit = originalEmit;
    };
  }, [socket]);

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