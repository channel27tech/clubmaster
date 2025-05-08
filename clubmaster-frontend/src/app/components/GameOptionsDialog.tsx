'use client';

import React, { useEffect, useRef, useState } from 'react';
import { playSound } from '../utils/soundEffects';

interface GameOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: {
    hasStarted: boolean;
    isWhiteTurn: boolean;
    hasWhiteMoved?: boolean;
    isGameOver?: boolean;
  };
  onDrawOffer: () => void;
  onResign: () => void;
  onAbort?: () => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => Promise<void>;
}

const GameOptionsDialog: React.FC<GameOptionsDialogProps> = ({
  isOpen,
  onClose,
  gameState,
  onDrawOffer,
  onResign,
  onAbort,
  soundEnabled,
  onSoundToggle,
}) => {
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

  // Only show Abort button before the game has started or before white's first move
  const canAbort = !gameState.hasStarted || (gameState.hasStarted && gameState.isWhiteTurn && !gameState.hasWhiteMoved);
  
  // Don't show game action buttons if the game is over
  const gameOver = gameState.isGameOver === true;

  return (
    <div 
      className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div 
        ref={dialogRef}
        className="bg-[#333939] text-white rounded-md shadow-lg overflow-hidden w-95"
      >
        <div className="flex flex-col divide-y divide-gray-700">
          {!gameOver && (
            <>
              <button 
                className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
                onClick={() => {
                  onDrawOffer();
                }}
                aria-label="Offer draw"
              >
                Draw
              </button>
              
              <button 
                className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
                onClick={() => {
                  onResign();
                }}
                aria-label="Resign from game"
              >
                Resign
              </button>
              
              {canAbort && (
                <button 
                  className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
                  onClick={() => {
                    onAbort && onAbort();
                  }}
                  aria-label="Abort game"
                >
                  Abort
                </button>
              )}
            </>
          )}
          
          <button 
            className={`py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors ${isToggling ? 'opacity-70' : ''}`}
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