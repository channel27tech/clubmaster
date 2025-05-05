'use client';

import React, { useEffect, useRef } from 'react';

interface GameOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: {
    hasStarted: boolean;
    isWhiteTurn: boolean;
    hasWhiteMoved?: boolean;
  };
  onDrawOffer: () => void;
  onResign: () => void;
  onAbort: () => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => void;
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

  if (!isOpen) return null;

  // Only show Abort button before the game has started or before white's first move
  const canAbort = !gameState.hasStarted || (gameState.hasStarted && gameState.isWhiteTurn && !gameState.hasWhiteMoved);

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
          <button 
            className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
            onClick={onDrawOffer}
            aria-label="Offer draw"
          >
            Draw
          </button>
          
          <button 
            className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
            onClick={onResign}
            aria-label="Resign from game"
          >
            Resign
          </button>
          
          {canAbort && (
            <button 
              className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
              onClick={onAbort}
              aria-label="Abort game"
            >
              Abort
            </button>
          )}
          
          <button 
            className="py-3.5 text-center hover:bg-[#4a4f4f] active:bg-[#585f5f] transition-colors"
            onClick={() => onSoundToggle(!soundEnabled)}
            aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
          >
            {soundEnabled ? "Disable Sound" : "Enable Sound"}
          </button>
        </div>
      </div>
      {/* Triangle pointer at the bottom */}
      <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-2 w-4 h-4 bg-[#333939] rotate-45"></div>
    </div>
  );
};

export default GameOptionsDialog; 