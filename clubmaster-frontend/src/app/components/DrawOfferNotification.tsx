'use client';

import React, { useEffect, useRef } from 'react';

interface DrawOfferNotificationProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  opponentName: string;
  // Optional countdown if you want to auto-decline after a time
  timeRemaining?: number;
}

const DrawOfferNotification: React.FC<DrawOfferNotificationProps> = ({
  isOpen,
  onAccept,
  onDecline,
  opponentName,
  timeRemaining
}) => {
  const notificationRef = useRef<HTMLDivElement>(null);

  // Focus trap inside notification when open
  useEffect(() => {
    if (isOpen && notificationRef.current) {
      const focusableElements = notificationRef.current.querySelectorAll(
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
      className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-[#333939] text-white rounded-md shadow-lg p-4 z-50 w-80"
      role="alert"
      ref={notificationRef}
    >
      <div className="flex flex-col">
        <div className="mb-3">
          <h3 className="font-semibold text-lg">Draw Offer</h3>
          <p className="mt-1">{opponentName} has offered a draw</p>
          {timeRemaining !== undefined && (
            <div className="mt-1 text-sm text-gray-300">
              Expires in {timeRemaining} seconds
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            className="px-4 py-2 rounded border border-gray-500 hover:bg-[#4a4f4f] transition-colors"
            onClick={onDecline}
          >
            Decline
          </button>
          <button 
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition-colors"
            onClick={onAccept}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawOfferNotification; 