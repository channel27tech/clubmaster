'use client';

import { useState, useCallback, useRef } from 'react';
import GameOptionsDialog from './GameOptionsDialog';
import ResignConfirmationDialog from './ResignConfirmationDialog';
import DrawOfferDialog from './DrawOfferDialog';
import AbortConfirmationDialog from './AbortConfirmationDialog';
import { useSocket } from '../../contexts/SocketContext';
import { useSound } from '../../contexts/SoundContext';
import { playSound } from '../utils/soundEffects';

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
  onOfferDraw?: () => void;
  onAbortGame?: () => void;
}

const MoveControls: React.FC<MoveControlsProps> = ({
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  gameId,
  gameState,
  onResign,
  onOfferDraw,
  onAbortGame
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
  const [isDrawDialogOpen, setIsDrawDialogOpen] = useState(false);
  const [isAbortDialogOpen, setIsAbortDialogOpen] = useState(false);

  // Handle options button click
  const handleOptionsClick = useCallback(() => {
    setIsOptionsDialogOpen(true);
  }, []);

  // Handle options dialog close
  const handleOptionsClose = useCallback(() => {
    setIsOptionsDialogOpen(false);
  }, []);

  // Handle draw offer
  const handleDrawOffer = useCallback(() => {
    setIsOptionsDialogOpen(false);
    setIsDrawDialogOpen(true);
  }, []);

  // Handle draw offer confirmation
  const handleDrawOfferConfirm = useCallback(() => {
    if (onOfferDraw) {
      onOfferDraw();
    } else if (socket) {
      socket.emit('offer_draw', { gameId });
    }
    setIsDrawDialogOpen(false);
  }, [onOfferDraw, socket, gameId]);

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
    }
    setIsResignDialogOpen(false);
  }, [onResign, socket, gameId]);

  // Handle abort request
  const handleAbortRequest = useCallback(() => {
    setIsOptionsDialogOpen(false);
    setIsAbortDialogOpen(true);
  }, []);

  // Handle abort confirmation
  const handleAbortConfirm = useCallback(() => {
    if (onAbortGame) {
      onAbortGame();
    } else if (socket) {
      socket.emit('abort_game', { gameId });
    }
    setIsAbortDialogOpen(false);
  }, [onAbortGame, socket, gameId]);

  // Handle sound toggle using the SoundContext
  const handleSoundToggle = useCallback(async (enabled: boolean) => {
    await toggleSound(enabled);
    setIsOptionsDialogOpen(false);
  }, [toggleSound]);

  // Disable controls if game is over
  const isDisabled = gameState.isGameOver;

  return (
    <div className="relative">
      <div className="w-full grid grid-cols-3 bg-[#333939] text-white py-3 mt-15">
        <button 
          ref={optionsButtonRef}
          className={`flex justify-center items-center ${isDisabled ? 'opacity-50' : ''}`}
          onClick={handleOptionsClick}
          disabled={isDisabled}
        >
          <div className="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1">Options</span>
          </div>
        </button>
        
        <button 
          className={`flex justify-center items-center ${!canGoBack ? 'opacity-50' : ''}`}
          onClick={() => {
            onBack();
            // Play button click sound only for back button
            soundEnabled && playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Back');
          }}
          disabled={!canGoBack}
        >
          <div className="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs mt-1">Back</span>
          </div>
        </button>
        
        <button 
          className={`flex justify-center items-center ${!canGoForward ? 'opacity-50' : ''}`}
          onClick={() => {
            onForward();
            // Play button click sound only for forward button
            soundEnabled && playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Forward');
          }}
          disabled={!canGoForward}
        >
          <div className="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs mt-1">Forward</span>
          </div>
        </button>
      </div>

      {/* Game Options Dialog */}
      {isOptionsDialogOpen && (
        <GameOptionsDialog
          isOpen={isOptionsDialogOpen}
          onClose={handleOptionsClose}
          gameState={gameState}
          onDrawOffer={handleDrawOffer}
          onResign={handleResignRequest}
          onAbort={handleAbortRequest}
          soundEnabled={soundEnabled}
          onSoundToggle={handleSoundToggle}
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

      {/* Draw Offer Confirmation Dialog */}
      {isDrawDialogOpen && (
        <DrawOfferDialog
          isOpen={isDrawDialogOpen}
          onConfirm={handleDrawOfferConfirm}
          onCancel={() => setIsDrawDialogOpen(false)}
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
    </div>
  );
};

export default MoveControls; 