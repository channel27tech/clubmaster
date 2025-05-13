'use client';

import React, { useState, useEffect } from 'react';
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

  // Debug logging
  useEffect(() => {
    console.log('AbortButton rendered with props:', { gameId, hasWhiteMoved, isPlayerWhite });
  }, [gameId, hasWhiteMoved, isPlayerWhite]);

  const handleAbortRequest = () => {
    console.log('Abort button clicked, opening confirmation dialog');
    setIsDialogOpen(true);
  };

  const handleConfirmAbort = () => {
    console.log('Abort confirmed, emitting abort_game event');
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
        className="flex flex-col justify-center items-center"
        aria-label="Abort Game"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-xs mt-1">Abort</span>
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