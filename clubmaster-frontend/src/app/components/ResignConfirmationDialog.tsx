'use client';

import React, { useEffect, useRef } from 'react';

interface ResignConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ResignConfirmationDialog: React.FC<ResignConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
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
      aria-labelledby="resign-dialog-title"
    >
      <div 
        ref={dialogRef}
        className="bg-[#333939] text-white rounded-md shadow-lg w-64 overflow-hidden"
      >
        <div className="p-4 flex flex-col items-center">
          <h2 
            id="resign-dialog-title" 
            className="text-lg font-medium mb-1"
          >
            Resign
          </h2>
          <p className="mb-4 text-center text-sm">
            Are you sure?
          </p>
          <div className="flex justify-center space-x-3 w-full">
          <button 
              className="flex-1 py-2 rounded transition-colors"
              style={{ backgroundColor: '#4A7C59' }}
              onClick={onConfirm}
>
              Yes
            </button>
            <button 
              className="flex-1 py-2 rounded bg-gray-500 hover:bg-gray-600 transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResignConfirmationDialog; 