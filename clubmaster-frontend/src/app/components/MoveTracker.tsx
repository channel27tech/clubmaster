import React, { useEffect, useState, useRef } from 'react';
import { getChessEngine } from '../utils/chessEngine';

// SVG paths for chess pieces
const CHESS_PIECES = {
  r: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1V4H2V6H3L2 13H9L8 6H9V4H8V1H6V3H5V1H3Z" fill="#9DA792" />
    </svg>
  ),
  n: (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1C3 1 1 3 1 5C1 6 1 7 3 8C2 9 2 10 2 10L1 13H11L10 10C10 10 9 7 6 6C6 6 8 5 8 3C8 2.5 7.5 1 5 1H3Z" fill="#9DA792" />
    </svg>
  ),
  q: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1L6 5L2 3L3 7L1 10H16L14 7L15 3L11 5L8.5 1Z" stroke="#9DA792" strokeWidth="1" />
      <path d="M4 14V10H13V14H4Z" stroke="#9DA792" strokeWidth="1" />
      <path d="M3 16V14H14V16H3Z" stroke="#9DA792" strokeWidth="1" />
    </svg>
  ),
  k: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1V5M6 3H11M4 14V10H13V14H4ZM3 16V14H14V16H3ZM3 10L4 7H13L14 10H3Z" stroke="#9DA792" strokeWidth="1" />
    </svg>
  ),
  p: (
    <svg width="10" height="15" viewBox="0 0 10 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 1C3.5 1 2.5 2 2.5 3.5C2.5 4.5 3 5.5 4 6C2.5 6.5 2 8 2 9C2 9.5 2 10 2.5 10.5H7.5C8 10 8 9.5 8 9C8 8 7.5 6.5 6 6C7 5.5 7.5 4.5 7.5 3.5C7.5 2 6.5 1 5 1Z" fill="#9DA792" />
      <path d="M2 12V11H8V12H2Z" fill="#9DA792" />
      <path d="M1.5 14V12H8.5V14H1.5Z" fill="#9DA792" />
    </svg>
  ),
  b: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 1C4.5 1 3.5 2 3.5 3C3.5 3.5 3.7 4 4 4.5C3 5.5 2 7 2 9C2 10 2.5 10.5 3 10.5H8C8.5 10.5 9 10 9 9C9 7 8 5.5 7 4.5C7.3 4 7.5 3.5 7.5 3C7.5 2 6.5 1 5.5 1Z" fill="#9DA792" />
      <path d="M3 12V11H8V12H3Z" fill="#9DA792" />
      <path d="M2 14V12H9V14H2Z" fill="#9DA792" />
    </svg>
  )
};

// Types for move tracking
interface ChessMoveDisplay {
  moveNumber: number;
  white: {
    piece: string;
    notation: string;
  };
  black: {
    piece: string;
    notation: string;
  } | null;
}

const MoveTracker: React.FC = () => {
  const [formattedMoves, setFormattedMoves] = useState<ChessMoveDisplay[]>([]);
  const [currentMove, setCurrentMove] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get moves from chess.js
    updateMoveList();

    // Set up an interval to check for new moves
    const interval = setInterval(updateMoveList, 500);
    
    return () => clearInterval(interval);
  }, []);

  // Scroll to current move when it changes
  useEffect(() => {
    if (scrollContainerRef.current && formattedMoves.length > 0) {
      const currentMoveElement = scrollContainerRef.current.querySelector(`[data-move-number="${currentMove}"]`);
      if (currentMoveElement) {
        currentMoveElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    }
  }, [currentMove, formattedMoves]);

  const updateMoveList = () => {
    try {
      const chessEngine = getChessEngine();
      const history = chessEngine.history({ verbose: true });
      
      if (history.length === 0) {
        setFormattedMoves([]);
        setCurrentMove(0);
        return;
      }

      const formattedMovesList: ChessMoveDisplay[] = [];
      
      for (let i = 0; i < history.length; i += 2) {
        const whiteMove = history[i];
        const blackMove = i + 1 < history.length ? history[i + 1] : null;
        
        formattedMovesList.push({
          moveNumber: Math.floor(i / 2) + 1,
          white: {
            piece: whiteMove.piece,
            notation: whiteMove.san
          },
          black: blackMove ? {
            piece: blackMove.piece,
            notation: blackMove.san
          } : null
        });
      }
      
      setFormattedMoves(formattedMovesList);
      
      // Update current move - this sets it to the latest move number
      if (formattedMovesList.length > 0) {
        setCurrentMove(Math.floor((history.length - 1) / 2) + 1);
      }
    } catch (error) {
      console.error('Error updating move list:', error);
    }
  };

  return (
    <div className="w-full bg-[#1A1D1D] border-b border-black">
      <div 
        ref={scrollContainerRef}
        className="flex items-center h-[25px] overflow-x-auto whitespace-nowrap touch-pan-x no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {formattedMoves.map((move) => (
          <div 
            key={move.moveNumber} 
            data-move-number={move.moveNumber}
            className={`flex items-center flex-shrink-0 relative ${move.moveNumber === currentMove ? 'bg-[#474F4F]' : ''}`}
          >
            <span className="text-[#9DA792] text-xs pl-2 pr-1 z-10 w-8">{move.moveNumber}.</span>
            <div className="flex items-center z-10 px-1">
              <div className="flex items-center mr-1">
                {CHESS_PIECES[move.white.piece as keyof typeof CHESS_PIECES]}
              </div>
              <span className="text-[#9DA792] text-xs">{move.white.notation}</span>
            </div>
            {move.black && (
              <div className="flex items-center z-10 px-1 mr-2">
                <div className="flex items-center mr-1">
                  {CHESS_PIECES[move.black.piece as keyof typeof CHESS_PIECES]}
                </div>
                <span className="text-[#9DA792] text-xs">{move.black.notation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoveTracker;

// Add this CSS to hide scrollbars while keeping scrolling functionality
const styles = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;

// Add style tag to document
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);
} 