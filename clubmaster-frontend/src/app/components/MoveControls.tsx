'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import GameOptionsDialog from './GameOptionsDialog';
import ResignConfirmationDialog from './ResignConfirmationDialog';
import AbortConfirmationDialog from './AbortConfirmationDialog';
import DrawConfirmationDialog from './DrawConfirmationDialog';
import { useSocket } from '../../context/SocketContext';
import { useSound } from '../../context/SoundContext';
import { playSound } from '../utils/soundEffects';

// Utility function to determine if game can be aborted
export const canAbortGame = (gameState: {
  hasStarted: boolean;
  hasWhiteMoved: boolean;
  isGameOver?: boolean;
}, moveHistory?: { length: number; currentMoveIndex: number; }): boolean => {
  // Game must not be over
  if (gameState.isGameOver) return false;
  
  // Any moves made?
  const hasMovesInHistory = moveHistory && (moveHistory.length > 0 || moveHistory.currentMoveIndex > -1);
  
  // Check if no moves have been made yet using all available signals
  // Game can only be aborted before any moves are made
  const noMovesMade = gameState.hasWhiteMoved === false && !hasMovesInHistory;
  
  return noMovesMade;
};

interface MoveControlsProps {
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  gameId: string;
  gameState: {
    hasStarted: boolean;
    isWhiteTurn: boolean;
    hasWhiteMoved: boolean;
    isGameOver?: boolean;
    gameResult?: string;
  };
  onResign?: () => void;
  onAbortGame?: () => void;
  moveHistory?: {
    length: number;
    currentMoveIndex: number;
  };
  whitePlayer?: {
    username: string;
    userId?: string;
  };
  blackPlayer?: {
    username: string;
    userId?: string;
  };
  playerColor?: 'white' | 'black' | null;
}

const MoveControls: React.FC<MoveControlsProps> = ({
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  gameId,
  gameState,
  onResign,
  onAbortGame,
  moveHistory,
  whitePlayer,
  blackPlayer,
  playerColor,
}) => {
  // Socket context for game actions
  const { socket } = useSocket();
  
  // Sound context for sound settings
  const { soundEnabled, toggleSound, isLoading: isSoundLoading } = useSound();
  
  // Reference to options button for positioning
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Dialog visibility states
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isResignDialogOpen, setIsResignDialogOpen] = useState(false);
  const [isAbortDialogOpen, setIsAbortDialogOpen] = useState(false);
  const [isDrawDialogOpen, setIsDrawDialogOpen] = useState(false);
  const [isDrawOfferPending, setIsDrawOfferPending] = useState(false);
  const [showDrawOfferModal, setShowDrawOfferModal] = useState(false);
  const [drawOfferFromOpponent, setDrawOfferFromOpponent] = useState<string | null>(null);
  const [amOfferingDraw, setAmOfferingDraw] = useState(false);

  // Add near the top of your component
  useEffect(() => {
    console.log("Socket connected:", socket?.connected);
    console.log("Socket instance:", socket);
  }, [socket]);

  // Handle options button click
  const handleOptionsClick = useCallback(() => {
    setIsOptionsDialogOpen(true);
  }, []);

  // Handle options dialog close
  const handleOptionsClose = useCallback(() => {
    setIsOptionsDialogOpen(false);
  }, []);

  // Handle resign request
  const handleResignRequest = useCallback(() => {
    setIsOptionsDialogOpen(false);
    setIsResignDialogOpen(true);
  }, []);

  // Handle resign confirmation
  const handleResignConfirm = useCallback(() => {
    if (onResign) {
      onResign();
    } else if (socket) {
      socket.emit('resign', { gameId });
      
      // Dispatch a local game_ended event to ensure the result screen shows
      // This is a backup in case the server event doesn't reach the client
      setTimeout(() => {
        console.log('Dispatching local game_ended event after resignation');
        const gameEndedEvent = new CustomEvent('game_ended', {
          detail: {
            reason: 'resignation',
            result: 'loss'  // The player who resigns loses
          }
        });
        window.dispatchEvent(gameEndedEvent);
      }, 500);  // Small delay to allow server event to arrive first
    }
    setIsResignDialogOpen(false);
  }, [onResign, socket, gameId]);

  // Handle abort request - shows confirmation dialog
  const handleAbortRequest = useCallback(() => {
    console.log("Abort requested for game:", gameId);
    setIsOptionsDialogOpen(false);
    setIsAbortDialogOpen(true);
  }, [gameId]);

  // Handle abort confirmation - executes actual abort after confirmation
  const handleAbortConfirm = useCallback(() => {
    console.log(`[${socket?.id}] Action: CONFIRMING ABORT for game ${gameId}. Emitting game_abort_request.`);
    if (socket) {
      socket.emit('game_abort_request', { gameId });
    } else {
      console.error("[MoveControls handleAbortConfirm] Socket not available to emit game_abort_request.");
    }
    setIsAbortDialogOpen(false); // Close the confirmation dialog immediately
  }, [socket, gameId]);

  // Handle sound toggle using the SoundContext
  const handleSoundToggle = useCallback(async (enabled: boolean) => {
    try {
      // Log sound toggle for debugging
      console.log(`MoveControls: Sound toggle requested: ${enabled ? 'enabled' : 'disabled'}`);
      
      // Close options dialog immediately to avoid UI interference
      setIsOptionsDialogOpen(false);
      
      // Important: Capture the current socket state for debugging
      const socketConnected = socket?.connected;
      console.log(`Sound toggle - Socket state before toggle: ${socketConnected ? 'connected' : 'disconnected'}`);
      
      // Use requestAnimationFrame to ensure UI updates complete first
      // This helps prevent any interference with the game state rendering
      requestAnimationFrame(() => {
        // Use a separate function to isolate the sound toggle operation
        const performSoundToggle = async () => {
          try {
            // Toggle sound in a completely isolated way
            await toggleSound(enabled);
            console.log(`MoveControls: Sound ${enabled ? 'enabled' : 'disabled'} successfully`);
            
            // Check socket state after toggle for debugging
            setTimeout(() => {
              console.log(`Sound toggle - Socket state after toggle: ${socket?.connected ? 'connected' : 'disconnected'}`);
            }, 100);
          } catch (error) {
            console.error('Error in sound toggle operation:', error);
          }
        };
        
        // Execute sound toggle in an isolated context
        performSoundToggle();
      });
    } catch (error) {
      console.error('Error in sound toggle handler:', error);
    }
  }, [toggleSound, socket]);

  // Disable controls if game is over
  const isDisabled = gameState.isGameOver;

  // Use the updated canAbortGame function with moveHistory
  const showAbortOption = canAbortGame(gameState, moveHistory);
  
  // Add check if the game can be resigned (game in progress, not over)
  const canResignGame = gameState.hasStarted && 
                      !gameState.isGameOver && 
                      (gameState.hasWhiteMoved || (moveHistory && moveHistory.length > 0));
  
  // Add debug logging
  useEffect(() => {
    console.log("MoveControls gameState:", gameState);
    console.log("moveHistory status:", {moveHistory: Boolean(moveHistory), length: moveHistory?.length, currentIndex: moveHistory?.currentMoveIndex});
    console.log("showAbortOption:", showAbortOption, "using canAbortGame");
  }, [gameState, showAbortOption, moveHistory]);

  // Debug log check for gameState and onAbortGame
  useEffect(() => {
    console.log("MoveControls DIRECT onAbortGame handler:", !!onAbortGame);
    console.log("MoveControls DIRECT socket connected:", !!socket?.connected);
    console.log("MoveControls DIRECT gameState:", gameState);
  }, [onAbortGame, socket, gameState]);

  // Determine if the player is white (in a real implementation, you would get this from game state)
  // This is just a placeholder - replace with actual logic to determine player color
  const isPlayerWhite = true;

  // Draw button click handler
  const handleDrawOfferClick = useCallback(() => {
    setIsOptionsDialogOpen(false);
    setIsDrawDialogOpen(true);
  }, []);

  // Confirm draw offer (when THIS client offers a draw)
  const handleDrawOfferConfirm = useCallback(() => {
    if (socket) {
      console.log(`[${socket.id}] Action: CONFIRMING MY DRAW OFFER for game ${gameId}. Emitting draw_request.`);
      socket.emit('draw_request', { gameId });
      setAmOfferingDraw(true);        // Player is actively offering
      setIsDrawOfferPending(true);    // Player is now waiting for a response
      setShowDrawOfferModal(false);   // Player should NOT see the incoming offer modal for their own offer
    }
    setIsDrawDialogOpen(false);     // Close the "Offer a draw?" confirmation dialog
  }, [socket, gameId]);

  // Cancel draw offer
  const handleDrawOfferCancel = useCallback(() => {
    setIsDrawDialogOpen(false);
  }, []);

  // Accept draw offer from opponent
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAcceptDraw = useCallback(() => {
    if (socket) {
      socket.emit('draw_response', { gameId, accepted: true });
    }
    setShowDrawOfferModal(false);
  }, [socket, gameId]);

  // Decline draw offer from opponent
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeclineDraw = useCallback(() => {
    if (socket) {
      socket.emit('draw_response', { gameId, accepted: false });
    }
    setShowDrawOfferModal(false);
  }, [socket, gameId]);

  // Listen for draw events from socket
  useEffect(() => {
    if (!socket) {
      console.log('[MoveControls SocketEffect] Socket is null, returning.');
      return;
    }
    const myCurrentSocketId = socket.id; // Capture at the time of effect setup
    console.log(`[${myCurrentSocketId}] [MoveControls SocketEffect] Setting up listeners. gameId: ${gameId}, amOfferingDraw: ${amOfferingDraw}, isDrawOfferPending: ${isDrawOfferPending}, showDrawOfferModal: ${showDrawOfferModal}`);

    const onDrawRequest = (data: { gameId?: string; playerId?: string }) => {
      if (!myCurrentSocketId) {
          console.warn('[MoveControls onDrawRequest] My socket ID is not available.');
          return;
      }

      console.log(`[${myCurrentSocketId}] EVENT: draw_request received. Data:`, data, `My current state: amOfferingDraw=${amOfferingDraw}, isDrawOfferPending=${isDrawOfferPending}`);

      // 1. Validate incoming data
      if (!data || typeof data.playerId === 'undefined' || typeof data.gameId === 'undefined') {
        console.warn(`[${myCurrentSocketId}] Received draw_request with incomplete data payload:`, data, ". This event will be ignored. This often happens to the offerer due to a local echo or misfire.");
        // The offerer's state (isDrawOfferPending=true, showDrawOfferModal=false) should already be set by handleDrawOfferConfirm.
        return;
      }

      // 2. Check if the event is for the current game
      if (data.gameId !== gameId) {
        console.log(`[${myCurrentSocketId}] Received draw_request for a different game (${data.gameId}). Current game is ${gameId}. Ignoring.`);
        return;
      }

      // 3. Determine role based on data.playerId
      if (myCurrentSocketId === data.playerId) {
        // I am the offerer (data.playerId is my ID).
        // My state should be: isDrawOfferPending=true (set by handleDrawOfferConfirm).
        console.log(`[${myCurrentSocketId}] Received draw_request where I am the offerer (playerId: ${data.playerId}). Ensuring 'Accept/Decline' modal is NOT shown for me. My pending state: ${isDrawOfferPending}.`);
        setShowDrawOfferModal(false); // Explicitly ensure the incoming offer modal is hidden for the offerer.
      } else {
        // I am the recipient (data.playerId is someone else's ID).
        console.log(`[${myCurrentSocketId}] Received draw_request from opponent ${data.playerId}. Showing 'Accept/Decline' modal.`);
        
        // Find the opponent's username based on their ID
        let opponentUsername = "Your opponent";
        if (whitePlayer?.userId === data.playerId) {
          opponentUsername = whitePlayer.username;
        } else if (blackPlayer?.userId === data.playerId) {
          opponentUsername = blackPlayer.username;
        }
        
        setDrawOfferFromOpponent(opponentUsername); // Store opponent's username instead of ID
        setShowDrawOfferModal(true);             // Show "Opponent offered a draw" modal
        setIsDrawOfferPending(false);            // Recipient is not pending their own offer.
        setAmOfferingDraw(false);                // Recipient is not in the process of offering.
      }
    };

    const onDrawResponse = (data: { gameId: string; accepted: boolean; offererId?: string; responderId?: string }) => {
      console.log(`[${myCurrentSocketId}] EVENT: draw_response received. Data:`, data);
      setIsDrawOfferPending(false); // If a response comes, offer is no longer pending for the offerer
      setAmOfferingDraw(false);     // The active offering process is resolved

      if (data.offererId === myCurrentSocketId) {
        if (data.accepted) {
          console.log(`[${myCurrentSocketId}] My draw offer was ACCEPTED by ${data.responderId}. Waiting for game_drawn event.`);
          // Game end will be handled by 'game_drawn' event
        } else {
          console.log(`[${myCurrentSocketId}] My draw offer was DECLINED by ${data.responderId}.`);
          // Optionally show a toast: "Your draw offer was declined."
        }
      }
      // Responder's modal (showDrawOfferModal) is closed via its own onConfirm/onCancel if they were the one responding.
      // If this client was the responder and declined, their modal would already be closed.
      // If this client was the offerer and the offer was declined, their state is updated above.
    };

    const onGameDrawn = (data: { gameId: string }) => {
      console.log(`[${myCurrentSocketId}] EVENT: game_drawn received. GameId: ${data.gameId}. Resetting all draw states and dispatching game_ended.`);
      setIsDrawDialogOpen(false);
      setIsDrawOfferPending(false);
      setShowDrawOfferModal(false);
      setDrawOfferFromOpponent(null);
      setAmOfferingDraw(false); // Reset this flag too

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game_ended', {
          detail: { reason: 'draw_agreement', result: 'draw', gameId: data.gameId }
        }));
      }
    };

    const onGameAborted = (data: { gameId: string }) => {
      console.log(`[${myCurrentSocketId}] EVENT: game_aborted received. GameId: ${data.gameId}. Dispatching game_ended.`);
      setIsAbortDialogOpen(false); // Ensure abort confirmation dialog is closed
      // Reset other relevant states if any in the future

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game_ended', {
          detail: { reason: 'aborted', result: 'aborted', gameId: data.gameId }
        }));
      }
    };

    const onGameAbortRejected = (data: { gameId: string; message?: string }) => {
      console.warn(`[${myCurrentSocketId}] EVENT: game_abort_rejected received for game ${data.gameId}. Message: ${data.message || 'No specific message.'}`);
      // Optionally, inform the user with a toast/notification
      setIsAbortDialogOpen(false); // Ensure abort confirmation dialog is closed
    };

    socket.on('draw_request', onDrawRequest);
    socket.on('draw_response', onDrawResponse);
    socket.on('game_drawn', onGameDrawn);
    socket.on('game_aborted', onGameAborted); // Add new listener
    socket.on('game_abort_rejected', onGameAbortRejected); // Add new optional listener

    return () => {
      console.log(`[${myCurrentSocketId}] [MoveControls SocketEffect Cleanup] Removing listeners. gameId: ${gameId}`);
      socket.off('draw_request', onDrawRequest);
      socket.off('draw_response', onDrawResponse);
      socket.off('game_drawn', onGameDrawn);
      socket.off('game_aborted', onGameAborted); // Clean up new listener
      socket.off('game_abort_rejected', onGameAbortRejected); // Clean up new optional listener
    };
  }, [socket, gameId, amOfferingDraw, isDrawOfferPending]); // Ensure all dependencies that might change how listeners behave are included

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[62px] bg-[#2B3131] flex justify-around items-center">
      {/* Options */}
      <div className="flex flex-col items-center">
        <button 
          ref={optionsButtonRef}
          className={`flex flex-col items-center ${isDisabled ? 'opacity-50' : ''}`}
          onClick={handleOptionsClick}
          disabled={isDisabled}
        >
          <img src="/icons/option_icon.svg" className="w-[20px] h-[20px]" alt="Options" />
          <span className="text-[#BFBFBF] text-[14px] font-[500] mt-1">Options</span>
        </button>
      </div>
      
      {/* Back */}
      <div className="flex flex-col items-center">
        <button 
          className={`flex flex-col items-center ${!canGoBack ? 'opacity-50' : ''}`}
          onClick={() => {
            // First play the sound
            if (soundEnabled) playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Back');
            // Then trigger the navigation with a slight delay
            requestAnimationFrame(() => onBack());
          }}
          disabled={!canGoBack}
        >
          <img src="/icons/back_arrow.svg" className="w-[20px] h-[20px]" alt="Back" />
          <span className="text-[#BFBFBF] text-[14px] font-[500] mt-1">Back</span>
        </button>
      </div>
      
      {/* Forward */}
      <div className="flex flex-col items-center">
        <button 
          className={`flex flex-col items-center ${!canGoForward ? 'opacity-50' : ''}`}
          onClick={() => {
            // First play the sound
            if (soundEnabled) playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Forward');
            // Then trigger the navigation with a slight delay
            requestAnimationFrame(() => onForward());
          }}
          disabled={!canGoForward}
        >
          <img src="/icons/forward_arrow.svg" className="w-[20px] h-[20px]" alt="Forward" />
          <span className="text-[#BFBFBF] text-[14px] font-[500] mt-1">Forward</span>
        </button>
      </div>

      {/* Game Options Dialog */}
      {isOptionsDialogOpen && (
        <GameOptionsDialog
          isOpen={isOptionsDialogOpen}
          onClose={handleOptionsClose}
          gameState={gameState}
          onResign={handleResignRequest}
          onAbort={handleAbortRequest}
          soundEnabled={soundEnabled}
          onSoundToggle={handleSoundToggle}
          onDrawOffer={handleDrawOfferClick}
        />
      )}

      {/* Resign Confirmation Dialog */}
      {isResignDialogOpen && (
        <ResignConfirmationDialog
          isOpen={isResignDialogOpen}
          onConfirm={handleResignConfirm}
          onCancel={() => setIsResignDialogOpen(false)}
        />
      )}

      {/* Abort Confirmation Dialog */}
      {isAbortDialogOpen && (
        <AbortConfirmationDialog
          isOpen={isAbortDialogOpen}
          onConfirm={handleAbortConfirm}
          onCancel={() => setIsAbortDialogOpen(false)}
        />
      )}

      {isDrawDialogOpen && (
        <DrawConfirmationDialog
          isOpen={isDrawDialogOpen}
          onConfirm={handleDrawOfferConfirm}
          onCancel={handleDrawOfferCancel}
        />
      )}

      {showDrawOfferModal && (
        <DrawConfirmationDialog
          isOpen={showDrawOfferModal}
          onConfirm={handleAcceptDraw}
          onCancel={handleDeclineDraw}
          isIncoming={true}
          opponentName={drawOfferFromOpponent || undefined}
        />
      )}
    </div>
  );
}

export default MoveControls; 