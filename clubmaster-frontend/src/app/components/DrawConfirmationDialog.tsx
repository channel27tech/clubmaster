import React, { useEffect, useRef } from 'react';

interface DrawConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isIncoming?: boolean;
  opponentName?: string;
}

const DrawConfirmationDialog: React.FC<DrawConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isIncoming = false,
  opponentName,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Debug log to check opponentName value
  useEffect(() => {
    if (isOpen && isIncoming) {
      console.log('DrawConfirmationDialog received opponentName:', opponentName);
    }
  }, [isOpen, isIncoming, opponentName]);

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

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onCancel]);

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

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-dialog-title"
    >
      <div 
        ref={dialogRef}
        className="bg-[#333939] text-white rounded-md shadow-lg w-64 overflow-hidden"
      >
        <div className="p-4 flex flex-col items-center">
          <h2 
            id="draw-dialog-title" 
            className="text-lg font-medium mb-1"
          >
            {isIncoming ? 'Draw Offer' : 'Offer Draw'}
          </h2>
          <p className="mb-4 text-center text-sm">
            {isIncoming
              ? `${opponentName ? opponentName + ' has' : 'Your opponent has'} offered a draw.`
              : 'Offer a draw to your opponent?'}
          </p>
          <div className="flex justify-center space-x-3 w-full">
            <button 
              className="flex-1 py-2 rounded transition-colors"
              style={{ backgroundColor: '#4A7C59' }}
              onClick={onConfirm}
            >
              {isIncoming ? 'Accept' : 'Yes'}
            </button>
            <button 
              className="flex-1 py-2 rounded bg-gray-500 hover:bg-gray-600 transition-colors"
              onClick={onCancel}
            >
              {isIncoming ? 'Decline' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawConfirmationDialog; 