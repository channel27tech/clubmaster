'use client';

import React, { useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import ResignConfirmationDialog from './ResignConfirmationDialog';
import { useSound } from '../../contexts/SoundContext';
import { playSound } from '../utils/soundEffects';

interface ResignButtonProps {
  gameId: string;
}

const ResignButton: React.FC<ResignButtonProps> = ({ gameId }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { resignGame } = useSocket();
  const { soundEnabled } = useSound();

  const handleResignRequest = () => {
    console.log('Resign button clicked, opening confirmation dialog');
    setIsDialogOpen(true);
  };

  const handleConfirmResign = () => {
    console.log('Resignation confirmed, emitting resign event');
    resignGame(gameId);
    setIsDialogOpen(false);
    
    // Play sound effect if enabled
    soundEnabled && playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Resign');
  };

  const handleCancelResign = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        onClick={handleResignRequest}
        className="flex flex-col justify-center items-center"
        aria-label="Resign Game"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span className="text-xs mt-1">Resign</span>
      </button>
      
      <ResignConfirmationDialog
        isOpen={isDialogOpen}
        onConfirm={handleConfirmResign}
        onCancel={handleCancelResign}
      />
    </>
  );
};

export default ResignButton; 