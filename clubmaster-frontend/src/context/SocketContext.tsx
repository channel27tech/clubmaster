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
      
      window.dispatchEvent(customEvent);
      
    } catch (err) {
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
      // Set connecting status initially
      setConnectionStatus('connecting');
      // Set isConnected to false initially, will be true after auth
      setIsConnected(false);

      // Get Firebase UID and ID token from AuthContext
      import('firebase/auth').then(({ getAuth }) => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        // Check if user is logged in and get ID token
        if (!currentUser) {
          // Proceed without auth, protected events will be blocked by backend guards
          const socketInstance = socketService.getSocket({
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
          });
          setSocket(socketInstance);
           // Update connection status based on the basic socket connection
           socketInstance.on('connect', () => {
             setConnectionStatus('connected');
             // --- JOIN USER ROOM LOGIC ---
             const backendUserId = localStorage.getItem('backendUserId');
             if (backendUserId) {
               socketInstance.emit('join_user_room', { userId: backendUserId });
               console.log('[SocketContext] Joined user room:', backendUserId);
             }
           });
           socketInstance.on('disconnect', () => setConnectionStatus('disconnected'));
           socketInstance.on('reconnect_attempt', () => setConnectionStatus('connecting'));
           socketInstance.on('reconnect', () => {
             setConnectionStatus('connected');
             // --- JOIN USER ROOM LOGIC ON RECONNECT ---
             const backendUserId = localStorage.getItem('backendUserId');
             if (backendUserId) {
               socketInstance.emit('join_user_room', { userId: backendUserId });
               console.log('[SocketContext] Re-joined user room:', backendUserId);
             }
           });
           socketInstance.on('reconnect_failed', () => setConnectionStatus('disconnected'));
           socketInstance.on('reconnect_error', () => setConnectionStatus('disconnected'));
          return;
        }

        currentUser.getIdToken().then((idToken) => {
          // Get the socket instance (don't pass token here for handshake)
          const socketInstance = socketService.getSocket({
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
          });
          
          setSocket(socketInstance);

          // Update connection states based on the basic socket connection
          socketInstance.on('connect', async () => {
            setConnectionStatus('connected'); // Socket is physically connected
            try {
              const authResult = await socketService.authenticateSocket(idToken);
              if (authResult.success) {
                setIsConnected(true); // Authenticated successfully
              } else {
                setIsConnected(false); // Not authenticated
              }
            } catch (error) {
              setIsConnected(false); // Authentication failed
            }
          });
          
          socketInstance.on('disconnect', (reason) => {
            setIsConnected(false); // Not connected/authenticated
            setConnectionStatus('disconnected');
            startDisconnectionTimer();
          });
          
          socketInstance.on('reconnect_attempt', (attemptNumber) => {
            setIsReconnecting(true);
            setConnectionStatus('connecting');
            setIsConnected(false); // Not authenticated during reconnect
          });
          
          socketInstance.on('reconnect', async (attemptNumber) => {
            setIsReconnecting(false);
            setConnectionStatus('connected');
            stopDisconnectionTimer();
            resetReconnectionAttempts();
            try {
              const authResult = await socketService.authenticateSocket(idToken);
              if (authResult.success) {
                setIsConnected(true); // Authenticated successfully
              } else {
                setIsConnected(false); // Not authenticated
              }
            } catch (error) {
              setIsConnected(false); // Authentication failed
            }
          });
          
          socketInstance.on('reconnect_failed', () => {
            setIsReconnecting(false);
            setConnectionStatus('disconnected');
            setIsConnected(false); // Not connected/authenticated
          });
          
          socketInstance.on('reconnect_error', (error) => {
            // Keep connectionStatus as is, isConnected becomes false
            setIsConnected(false); // Not authenticated
          });

          // Generic game end event
          socketInstance.on('game_end', (data) => {
            // Enhance with additional handling for resignation events
            if (data.reason === 'resignation') {
              // Check if we have explicit winner/loser IDs
              const mySocketId = socketInstance.id;
              const winnerSocketId = data.winnerSocketId || data.winnerId || data.winner;
              const loserSocketId = data.loserSocketId || data.loserId || data.loser;
              
              // If we have an explicit result from the server, use it
              if (data.result === 'win' || data.result === 'loss') {
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
            
            // Add specific handling for checkmate
            if (data.reason === 'checkmate') {
              // Determine winner based on winnerColor/loserColor for player color matching
              if (data.winnerColor && data.loserColor) {
                // We'll need to get the player's color from the context - might require passing playerColor to the socket context
                // For now, we'll continue using socketId comparison as fallback
              }
              
              // Fallback to socket ID comparison if color approach isn't explicitly used by the component
              const mySocketId = socketInstance.id;
              const winnerSocketId = data.winnerSocketId || data.winnerId || data.winner;
              const loserSocketId = data.loserSocketId || data.loserId || data.loser;
              
              // Determine winner based on socket IDs
              if (winnerSocketId && loserSocketId) {
                const winner = mySocketId === winnerSocketId ? 'you' : 
                              mySocketId === loserSocketId ? 'opponent' : 'draw';
                processGameEndEvent(data, 'checkmate', winner);
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
            
            // Default result - will be overridden if we have better information
            let finalResult: 'you' | 'opponent' | 'draw' = 'opponent'; // For resignations, default to loss
            
            // If we have an explicit result from the server, use it
            if (explicitResult === 'win' || explicitResult === 'loss' || explicitResult === 'draw') {
              finalResult = explicitResult === 'win' ? 'you' : 
                           explicitResult === 'loss' ? 'opponent' : 'draw';
            }
            // If socket IDs match, use that match
            else if (isWinner || isLoser) {
              finalResult = isWinner ? 'you' : 'opponent';
            }
            // If this client is the resigning player, they always lose
            else if (isResigning) {
              finalResult = 'opponent'; // "opponent" means the opponent won, so the current player lost
            }
            // Last resort fallback with warning when we can't determine winner/loser
            else {
              // For resignations, NEVER default to draw
              // Instead, check if there's any indication this is the resigning player
              if (data.isResigningPlayer || data.resigner === mySocketId) {
                finalResult = 'opponent'; // Current player loses
              }
            }
            
            // Process the game end event with our determined result
            processGameEndEvent(data, 'resignation', finalResult);
            
            // Always force both players to show game result screen by dispatching an event
            // This is crucial - even if the server event is correctly received but not processed,
            // this will ensure the UI shows the result
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('game_ended', { 
                  detail: { 
                    reason: 'resignation',
                    result: finalResult === 'you' ? 'win' : 
                            finalResult === 'opponent' ? 'loss' : 'draw',
                    timestamp: Date.now(), 
                    source: 'socketContext',
                    winnerSocketId, 
                    loserSocketId
                  } 
                }));
              }, 1000);
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
            // The detailed handling is done in another useEffect, this is just for debugging
          });
          
        }).catch((error) => {
          // Proceed with unauthenticated socket
           const socketInstance = socketService.getSocket({
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
          });
          setSocket(socketInstance);
           // Update connection status based on the basic socket connection
           socketInstance.on('connect', () => setConnectionStatus('connected'));
           socketInstance.on('disconnect', () => setConnectionStatus('disconnected'));
           socketInstance.on('reconnect_attempt', () => setConnectionStatus('connecting'));
           socketInstance.on('reconnect', () => setConnectionStatus('connected'));
           socketInstance.on('reconnect_failed', () => setConnectionStatus('disconnected'));
           socketInstance.on('reconnect_error', () => setConnectionStatus('disconnected'));
        });
        
      }).catch((error) => {
        // Proceed with unauthenticated socket
         const socketInstance = socketService.getSocket({
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          timeout: 20000,
        });
        setSocket(socketInstance);
         // Update connection status based on the basic socket connection
         socketInstance.on('connect', () => setConnectionStatus('connected'));
         socketInstance.on('disconnect', () => setConnectionStatus('disconnected'));
         socketInstance.on('reconnect_attempt', () => setConnectionStatus('connecting'));
         socketInstance.on('reconnect', () => setConnectionStatus('connected'));
         socketInstance.on('reconnect_failed', () => setConnectionStatus('disconnected'));
         socketInstance.on('reconnect_error', () => setConnectionStatus('disconnected'));
      });
      
    } catch (error) {
      setConnectionStatus('disconnected');
      setIsConnected(false); // Not connected/authenticated
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
      
    } catch (error) {
    }
  };

  // Abort a game
  const abortGame = (gameId: string) => {
    if (socket?.connected) {
      socket.emit('abort_game', { gameId });
      
      // Add listener for abort response
      socket.once('abortGameResponse', (response: any) => {
        if (response.data.success) {
        } else {
        }
      });
    } else {
    }
  };
  
  // Rejoin a game after reconnection
  const rejoinGame = (gameId: string, playerId: string) => {
    if (socket?.connected) {
      socket.emit('rejoin_game', { gameId, playerId });
    } else {
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
          return handler(data);
        };
        return originalOn.call(this, event, enhancedHandler);
      }
      
      return originalOn.call(this, event, handler);
    };
    
    // Listen for game state updates
    const handleGameState = (data: any) => {
      // If the game state includes hasWhiteMoved, update our local state tracking
      if (data.hasWhiteMoved !== undefined) {
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