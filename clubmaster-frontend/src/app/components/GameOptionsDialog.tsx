'use client';

import React, { useEffect, useRef, useState } from 'react';
import { playSound } from '../utils/soundEffects';
import { canAbortGame } from './MoveControls';

interface GameOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: {
    hasStarted: boolean;
    isWhiteTurn: boolean;
    hasWhiteMoved?: boolean;
    isGameOver?: boolean;
  };
  moveHistory?: {
    length: number;
    currentMoveIndex: number;
  };
  onResign: () => void;
  onAbort?: () => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => Promise<void>;
  onDrawOffer?: () => void;
}

const GameOptionsDialog: React.FC<GameOptionsDialogProps> = ({
  isOpen,
  onClose,
  gameState,
  moveHistory,
  onResign,
  onAbort,
  soundEnabled,
  onSoundToggle,
  onDrawOffer,
}) => {
  // DIRECT CONSOLE LOG FOR DEBUGGING
  console.log('DIRECT GameOptionsDialog props gameState:', JSON.stringify(gameState));
  console.log('DIRECT GameOptionsDialog onAbort available:', !!onAbort);

  // Robust movesMade check: true if hasWhiteMoved is true OR moveHistory has moves
  const movesMade = gameState.hasWhiteMoved === true || (moveHistory && moveHistory.length > 0);

  console.log('DIRECT GameOptionsDialog moves made check:', movesMade);
  
  // Add direct debug logs for all conditions
  console.log('CRITICAL: GameOptionsDialog condition states:', {
    movesMade,
    hasWhiteMoved: gameState.hasWhiteMoved,
    isGameOver: gameState.isGameOver,
    hasStarted: gameState.hasStarted,
    isWhiteTurn: gameState.isWhiteTurn
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Handle click outside dialog to close
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Handle ESC key press to close dialog
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Focus trap inside dialog when open
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  // Reset errors when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setToggleError(null);
    }
  }, [isOpen]);

  // Direct sound generation function that always works
  const playDirectClickSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.log('AudioContext not supported in this browser');
        return;
      }
      
      const audioContext = new AudioContext();
      
      // Create a short "click" oscillator sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Failed to play direct click sound:', error);
      // Try regular sound as fallback
      try {
        playSound('BUTTON_CLICK', true);
      } catch (e) {
        console.error('Both sound methods failed', e);
      }
    }
  };

  // Safe function to play sounds that won't break if sound fails
  const safePlaySound = (soundName: Parameters<typeof playSound>[0], buttonLabel: string) => {
    try {
      // Only play sound for sound toggle buttons
      if (buttonLabel.includes('Sound')) {
        // First try the direct sound method
        playDirectClickSound();
      }
    } catch (err) {
      console.warn(`Failed to play direct sound, trying fallback:`, err);
      // Fallback to regular sound API
      try {
        // Always force sound to play for UI feedback regardless of user sound setting
        // but only for sound toggle buttons
        if (buttonLabel.includes('Sound')) {
          playSound(soundName, true, 1.0, buttonLabel);
        }
      } catch (secondError) {
        console.warn(`All sound methods failed:`, secondError);
      }
    }
  };

  // Handle sound toggle with loading state
  const handleSoundToggle = () => {
    if (isToggling) return; // Prevent multiple clicks
    
    // Play click sound directly with the browser Audio API
    // This is completely isolated from the WebSocket system
    playDirectClickSound();
    
    // Store the new sound state
    const newSoundEnabled = !soundEnabled;
    
    // Close dialog immediately - BEFORE any network operations
    onClose();
    
    // Set sound in localStorage directly for immediate effect
    // This ensures the change works even if server updates fail
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('soundEnabled', newSoundEnabled.toString());
    }
    
    // Queue the server update with maximum isolation
    // Use nested setTimeout to ensure maximum separation from any game operations
    setTimeout(() => {
      setTimeout(() => {
        try {
          onSoundToggle(newSoundEnabled).catch(err => {
            console.error('Silent sound toggle error:', err);
            // Errors are silently caught since dialog is closed and localStorage is set
          });
        } catch (err) {
          console.error('Silent sound toggle outer error:', err);
        }
      }, 200);
    }, 200);
  };

  if (!isOpen) return null;

  // Show Abort button if:
  // 1. The game has not had any moves made (hasWhiteMoved is strictly false)
  // 2. We have an abort handler to call (passed from MoveControls)
  // 3. The game is not over
  const showAbortButton = !!onAbort && !gameState.isGameOver && gameState.hasWhiteMoved === false;

  // Add debug logging for the abort button visibility with simplified conditions
  useEffect(() => {
    console.log("GameOptionsDialog - Abort button visibility:", {
      showAbortButton,
      hasAbortHandler: !!onAbort,
      isGameOver: gameState.isGameOver,
      hasStarted: gameState.hasStarted,
      hasWhiteMoved: gameState.hasWhiteMoved,
      movesMade,
      simplifiedCondition: gameState.hasWhiteMoved === false
    });
  }, [showAbortButton, onAbort, gameState, movesMade]);

  // Standard game in progress checks - FIX: Always allow these options when game is in progress
  const canResign = !gameState.isGameOver && (gameState.hasStarted || true);
  const gameOver = !!gameState.isGameOver;
  
  // CRITICAL DEBUG for game option buttons
  console.log("CRITICAL: Game Option Buttons Visibility:", {
    canResign,
    showAbortButton,
    gameOver
  });

  return (
    <div 
      className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-xs px-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div 
        ref={dialogRef}
        className="bg-[#333939] text-white rounded-md shadow-lg overflow-hidden w-full"
      >
        <div className="flex flex-col divide-y divide-gray-700">
          {/* FIXED: Changed from !gameOver to include game in progress options regardless */}
          <>
            {canResign && movesMade && (
              <button 
                className="py-3.5 px-4 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors font-medium"
                onClick={() => {
                  console.log("Resign button clicked");
                  onResign();
                }}
                aria-label="Resign from game"
              >
                Resign
              </button>
            )}
            
            {/* Show Abort button at game start before any moves are made */}
            {showAbortButton && (
              <button 
                className="py-3.5 px-4 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors font-medium"
                onClick={() => {
                  console.log("Abort button clicked");
                  if (onAbort) onAbort();
                }}
                aria-label="Force Abort game"
              >
                Abort
              </button>
            )}
          </>
          
          {onDrawOffer && canResign && movesMade && (
            <button
              className="py-3.5 px-4 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors font-medium"
              onClick={() => {
                if (onDrawOffer) onDrawOffer();
              }}
              aria-label="Offer draw"
            >
              Draw
            </button>
          )}
          
          <button 
            className={`py-3.5 px-4 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors font-medium ${isToggling ? 'opacity-70' : ''}`}
            onClick={handleSoundToggle}
            disabled={isToggling}
            aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
          >
            {isToggling ? "Updating..." : (soundEnabled ? "Disable Sound" : "Enable Sound")}
          </button>
          
          {toggleError && (
            <div className="py-2 px-3 text-xs text-amber-300 bg-[#39393a] border-t border-gray-700">
              {toggleError}
            </div>
          )}
        </div>
      </div>
      {/* Triangle pointer at the bottom */}
      <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-2 w-4 h-4 bg-[#333939] rotate-45"></div>
    </div>
  );
};

export default GameOptionsDialog; 