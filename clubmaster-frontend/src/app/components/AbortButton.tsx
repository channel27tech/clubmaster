'use client';

import React, { useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import AbortConfirmationDialog from './AbortConfirmationDialog';

interface AbortButtonProps {
  gameId: string;
  hasWhiteMoved: boolean;
  isPlayerWhite: boolean;
}

const AbortButton: React.FC<AbortButtonProps> = ({ 
  gameId, 
  hasWhiteMoved, 
  isPlayerWhite 
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { abortGame } = useSocket();

  if (hasWhiteMoved) {
    return null;
  }

  const handleAbortRequest = () => {
    setIsDialogOpen(true);
  };

  const handleConfirmAbort = () => {
    abortGame(gameId);
    setIsDialogOpen(false);
  };

  const handleCancelAbort = () => {
    setIsDialogOpen(false);
  };

  const buttonText = isPlayerWhite 
    ? "Abort Game" 
    : "Abort Game (until White moves)";

  return (
    <>
      <button
        onClick={handleAbortRequest}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        aria-label="Abort Game"
      >
        {buttonText}
      </button>
      
      <AbortConfirmationDialog
        isOpen={isDialogOpen}
        onConfirm={handleConfirmAbort}
        onCancel={handleCancelAbort}
        isPlayerWhite={isPlayerWhite}
      />
    </>
  );
};

export default AbortButton; 