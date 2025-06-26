import React, { useEffect, useState, useRef } from 'react';

// SVG paths for chess pieces
const CHESS_PIECES = {
  r: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1V4H2V6H3L2 13H9L8 6H9V4H8V1H6V3H5V1H3Z" fill="#9DA692" />
    </svg>
  ),
  n: (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1C3 1 1 3 1 5C1 6 1 7 3 8C2 9 2 10 2 10L1 13H11L10 10C10 10 9 7 6 6C6 6 8 5 8 3C8 2.5 7.5 1 5 1H3Z" fill="#9DA692" />
    </svg>
  ),
  q: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1L6 5L2 3L3 7L1 10H16L14 7L15 3L11 5L8.5 1Z" stroke="#9DA692" strokeWidth="1" />
      <path d="M4 14V10H13V14H4Z" stroke="#9DA692" strokeWidth="1" />
      <path d="M3 16V14H14V16H3Z" stroke="#9DA692" strokeWidth="1" />
    </svg>
  ),
  k: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1V5M6 3H11M4 14V10H13V14H4ZM3 16V14H14V16H3ZM3 10L4 7H13L14 10H3Z" stroke="#9DA692" strokeWidth="1" />
    </svg>
  ),
  p: (
    <svg width="10" height="15" viewBox="0 0 10 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 1C3.5 1 2.5 2 2.5 3.5C2.5 4.5 3 5.5 4 6C2.5 6.5 2 8 2 9C2 9.5 2 10 2.5 10.5H7.5C8 10 8 9.5 8 9C8 8 7.5 6.5 6 6C7 5.5 7.5 4.5 7.5 3.5C7.5 2 6.5 1 5 1Z" fill="#9DA692" />
      <path d="M2 12V11H8V12H2Z" fill="#9DA692" />
      <path d="M1.5 14V12H8.5V14H1.5Z" fill="#9DA692" />
    </svg>
  ),
  b: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 1C4.5 1 3.5 2 3.5 3C3.5 3.5 3.7 4 4 4.5C3 5.5 2 7 2 9C2 10 2.5 10.5 3 10.5H8C8.5 10.5 9 10 9 9C9 7 8 5.5 7 4.5C7.3 4 7.5 3.5 7.5 3C7.5 2 6.5 1 5.5 1Z" fill="#9DA692" />
      <path d="M3 12V11H8V12H3Z" fill="#9DA692" />
      <path d="M2 14V12H9V14H2Z" fill="#9DA692" />
    </svg>
  )
};

// Types for move tracking
interface ChessMoveDisplay {
  moveNumber: number;
  white: {
    piece: string; // e.g., 'p', 'n', 'k'
    notation: string; // SAN, e.g., 'e4', 'Nf3'
  };
  black: {
    piece: string;
    notation: string;
  } | null;
}

interface MoveTrackerProps {
  moves: string[]; // Array of SAN strings from parent
  currentMoveIndex?: number; // Index of the currently selected move (-1 for initial position)
  onMoveClick?: (moveIndex: number) => void; // Callback when a move is clicked
}

// Helper to infer piece character from SAN for icon display
const getPieceCharFromSan = (san: string): string => {
  if (!san) return 'p'; // Default to pawn if SAN is empty
  if (san.startsWith('O-O')) return 'k'; // Castle king side or queen side
  const firstChar = san.charAt(0);
  if (['K', 'Q', 'R', 'B', 'N'].includes(firstChar)) {
    return firstChar.toLowerCase();
  }
  return 'p'; // Pawn move (e.g., e4, d5, exd5)
};

const MoveTracker: React.FC<MoveTrackerProps> = ({ moves, currentMoveIndex = -1, onMoveClick }) => {
  const [formattedMoves, setFormattedMoves] = useState<ChessMoveDisplay[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newFormattedMoves: ChessMoveDisplay[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const whiteSan = moves[i];
      const blackSan = i + 1 < moves.length ? moves[i + 1] : null;

      newFormattedMoves.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: {
          piece: getPieceCharFromSan(whiteSan),
          notation: whiteSan,
        },
        black: blackSan
          ? {
              piece: getPieceCharFromSan(blackSan),
              notation: blackSan,
            }
          : null,
      });
    }
    setFormattedMoves(newFormattedMoves);
  }, [moves]);

  // Scroll to the selected move when currentMoveIndex changes
  useEffect(() => {
    if (scrollContainerRef.current && currentMoveIndex >= 0) {
      // Calculate which formatted move contains our current move index
      const moveNumber = Math.floor(currentMoveIndex / 2) + 1;
      
      // Find the element with that move number
      const moveElements = scrollContainerRef.current.querySelectorAll('[data-move-number]');
      const targetElement = Array.from(moveElements).find(
        (el) => Number(el.getAttribute('data-move-number')) === moveNumber
      );
      
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentMoveIndex]);

  // Handle click on a move
  const handleMoveClick = (moveNumber: number, isWhite: boolean) => {
    if (!onMoveClick) return;
    
    // Calculate the actual move index from the move number and color
    const moveIndex = (moveNumber - 1) * 2 + (isWhite ? 0 : 1);
    onMoveClick(moveIndex);
  };

  // Handle click on initial position
  const handleInitialPositionClick = () => {
    if (onMoveClick) {
      onMoveClick(-1); // -1 represents the initial position
    }
  };

  return (
    <div className="w-full bg-[#1F2323] border-b border-black">
      <div 
        ref={scrollContainerRef}
        className="flex items-center h-[25px] overflow-x-auto whitespace-nowrap touch-pan-x no-scrollbar"
        style={{ scrollbarWidth: 'none' }} // For Firefox
      >
        {/* Initial position indicator */}
        {moves.length > 0 && (
          <div 
            className={`flex items-center flex-shrink-0 px-2 py-[1px] mx-1 cursor-pointer ${currentMoveIndex === -1 ? 'bg-[#4C5454] rounded-[2px]' : 'hover:bg-[#2A2E2E]'}`}
            onClick={handleInitialPositionClick}
          >
            <span className="text-[#9DA692] text-xs">Start</span>
          </div>
        )}
        
        {formattedMoves.map((move, index) => {
          // Determine if white or black move is selected
          const isWhiteSelected = currentMoveIndex === (move.moveNumber - 1) * 2;
          const isBlackSelected = move.black && currentMoveIndex === (move.moveNumber - 1) * 2 + 1;
          const isLastMove = index === formattedMoves.length - 1;
          
          return (
          <div 
            key={move.moveNumber} 
            data-move-number={move.moveNumber}
              className={`flex items-center flex-shrink-0 relative ${isLastMove && !isWhiteSelected && !isBlackSelected ? 'bg-[#4C5454] rounded-[2px] px-2 py-[1px] mx-1' : ''}`}
          >
            <span className="text-[#9DA692] text-xs pl-2 pr-1 z-10 w-6">{move.moveNumber}.</span>
              <div 
                className={`flex items-center z-10 px-1 cursor-pointer rounded-[2px] ${isWhiteSelected ? 'bg-[#4C5454]' : 'hover:bg-[#2A2E2E]'}`}
                onClick={() => handleMoveClick(move.moveNumber, true)}
              >
              {CHESS_PIECES[move.white.piece as keyof typeof CHESS_PIECES] && (
                <div className="flex items-center mr-1">
                  {CHESS_PIECES[move.white.piece as keyof typeof CHESS_PIECES]}
                </div>
              )}
              <span className="text-[#9DA692] text-xs">{move.white.notation}</span>
            </div>
            {move.black && (
                <div 
                  className={`flex items-center z-10 px-1 mr-2 cursor-pointer rounded-[2px] ${isBlackSelected ? 'bg-[#4C5454]' : 'hover:bg-[#2A2E2E]'}`}
                  onClick={() => handleMoveClick(move.moveNumber, false)}
                >
                {CHESS_PIECES[move.black.piece as keyof typeof CHESS_PIECES] && (
                  <div className="flex items-center mr-1">
                    {CHESS_PIECES[move.black.piece as keyof typeof CHESS_PIECES]}
                  </div>
                )}
                <span className="text-[#9DA692] text-xs">{move.black.notation}</span>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default MoveTracker;

// CSS to hide scrollbars (can be moved to a global CSS file if preferred)
const styles = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  // Check if a style tag with this ID already exists to prevent duplicates during HMR
  if (!document.getElementById('no-scrollbar-styles')) {
    styleTag.id = 'no-scrollbar-styles';
    document.head.appendChild(styleTag);
  }
} 