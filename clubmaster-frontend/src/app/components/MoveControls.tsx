'use client';

import { useCallback } from 'react';

interface MoveControlsProps {
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const MoveControls: React.FC<MoveControlsProps> = ({
  onBack,
  onForward,
  canGoBack,
  canGoForward
}) => {
  const handleOptionsClick = useCallback(() => {
    // Will implement options functionality later
    console.log('Options clicked');
  }, []);

  return (
    <div className="w-full grid grid-cols-3 bg-[#333939] text-white py-3 mt-15">
      <button 
        className="flex justify-center items-center"
        onClick={handleOptionsClick}
      >
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1">Options</span>
        </div>
      </button>
      
      <button 
        className={`flex justify-center items-center ${!canGoBack ? 'opacity-50' : ''}`}
        onClick={onBack}
        disabled={!canGoBack}
      >
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs mt-1">Back</span>
        </div>
      </button>
      
      <button 
        className={`flex justify-center items-center ${!canGoForward ? 'opacity-50' : ''}`}
        onClick={onForward}
        disabled={!canGoForward}
      >
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs mt-1">Forward</span>
        </div>
      </button>
    </div>
  );
};

export default MoveControls; 