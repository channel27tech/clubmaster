'use client';

import React, { useEffect, useRef } from 'react';

interface AbortConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPlayerWhite: boolean;
}

const AbortConfirmationDialog: React.FC<AbortConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isPlayerWhite,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle click outside dialog to close
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    // Handle ESC key press to close dialog
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    // Handle Enter key to confirm
    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
      document.addEventListener('keydown', handleEnterKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('keydown', handleEnterKey);
    };
  }, [isOpen, onCancel, onConfirm]);

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

  const message = isPlayerWhite
    ? "Aborting the game will end it immediately with no rating change. This option is only available before you make your first move."
    : "Aborting the game will end it immediately with no rating change. This option is only available before White makes their first move.";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel}></div>
      <div className="relative bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Abort Game?</h2>
        
        <p className="text-white mb-6">{message}</p>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Abort Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default AbortConfirmationDialog; 