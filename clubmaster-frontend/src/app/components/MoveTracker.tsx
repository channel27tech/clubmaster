import React from 'react';

// SVG paths for chess pieces
const CHESS_PIECES = {
  rook: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1V4H2V6H3L2 13H9L8 6H9V4H8V1H6V3H5V1H3Z" fill="#9DA792" />
    </svg>
  ),
  knight: (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1C3 1 1 3 1 5C1 6 1 7 3 8C2 9 2 10 2 10L1 13H11L10 10C10 10 9 7 6 6C6 6 8 5 8 3C8 2.5 7.5 1 5 1H3Z" fill="#9DA792" />
    </svg>
  ),
  queen: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1L6 5L2 3L3 7L1 10H16L14 7L15 3L11 5L8.5 1Z" stroke="#9DA792" strokeWidth="1" />
      <path d="M4 14V10H13V14H4Z" stroke="#9DA792" strokeWidth="1" />
      <path d="M3 16V14H14V16H3Z" stroke="#9DA792" strokeWidth="1" />
    </svg>
  ),
  king: (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1V5M6 3H11M4 14V10H13V14H4ZM3 16V14H14V16H3ZM3 10L4 7H13L14 10H3Z" stroke="#9DA792" strokeWidth="1" />
    </svg>
  ),
  pawn: (
    <svg width="10" height="15" viewBox="0 0 10 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 1C3.5 1 2.5 2 2.5 3.5C2.5 4.5 3 5.5 4 6C2.5 6.5 2 8 2 9C2 9.5 2 10 2.5 10.5H7.5C8 10 8 9.5 8 9C8 8 7.5 6.5 6 6C7 5.5 7.5 4.5 7.5 3.5C7.5 2 6.5 1 5 1Z" fill="#9DA792" />
      <path d="M2 12V11H8V12H2Z" fill="#9DA792" />
      <path d="M1.5 14V12H8.5V14H1.5Z" fill="#9DA792" />
    </svg>
  ),
  bishop: (
    <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 1C4.5 1 3.5 2 3.5 3C3.5 3.5 3.7 4 4 4.5C3 5.5 2 7 2 9C2 10 2.5 10.5 3 10.5H8C8.5 10.5 9 10 9 9C9 7 8 5.5 7 4.5C7.3 4 7.5 3.5 7.5 3C7.5 2 6.5 1 5.5 1Z" fill="#9DA792" />
      <path d="M3 12V11H8V12H3Z" fill="#9DA792" />
      <path d="M2 14V12H9V14H2Z" fill="#9DA792" />
    </svg>
  )
};

interface MoveTrackerProps {
  moves?: {
    moveNumber: number;
    white: {
      piece: 'rook' | 'knight' | 'queen' | 'king' | 'pawn' | 'bishop';
      notation: string;
    };
    black: {
      piece: 'rook' | 'knight' | 'queen' | 'king' | 'pawn' | 'bishop';
      notation: string;
    };
  }[];
  currentMove?: number;
}

const MoveTracker: React.FC<MoveTrackerProps> = ({ 
  moves = [
    { 
      moveNumber: 1, 
      white: { piece: 'pawn', notation: 'd4' }, 
      black: { piece: 'pawn', notation: 'd5' }
    },
    { 
      moveNumber: 2, 
      white: { piece: 'pawn', notation: 'c4' }, 
      black: { piece: 'pawn', notation: 'e6' }
    },
    { 
      moveNumber: 3, 
      white: { piece: 'knight', notation: 'Nc3' }, 
      black: { piece: 'knight', notation: 'Nf6' }
    },
    { 
      moveNumber: 4, 
      white: { piece: 'knight', notation: 'Nf3' }, 
      black: { piece: 'bishop', notation: 'Be7' }
    },
    { 
      moveNumber: 5, 
      white: { piece: 'bishop', notation: 'Bg5' }, 
      black: { piece: 'pawn', notation: 'O-O' }
    },
    { 
      moveNumber: 6, 
      white: { piece: 'pawn', notation: 'e3' }, 
      black: { piece: 'pawn', notation: 'h6' }
    },
    { 
      moveNumber: 7, 
      white: { piece: 'bishop', notation: 'Bh4' }, 
      black: { piece: 'bishop', notation: 'b6' }
    },
    { 
      moveNumber: 8, 
      white: { piece: 'pawn', notation: 'cxd5' }, 
      black: { piece: 'pawn', notation: 'exd5' }
    },
    { 
      moveNumber: 9, 
      white: { piece: 'bishop', notation: 'Bd3' }, 
      black: { piece: 'bishop', notation: 'Bb7' }
    },
    { 
      moveNumber: 10, 
      white: { piece: 'pawn', notation: 'O-O' }, 
      black: { piece: 'knight', notation: 'Nbd7' }
    },
    { 
      moveNumber: 11, 
      white: { piece: 'rook', notation: 'Re1' }, 
      black: { piece: 'pawn', notation: 'c5' }
    },
    { 
      moveNumber: 12, 
      white: { piece: 'pawn', notation: 'dxc5' }, 
      black: { piece: 'bishop', notation: 'Bxc5' }
    },
    { 
      moveNumber: 13, 
      white: { piece: 'queen', notation: 'Qc2' }, 
      black: { piece: 'rook', notation: 'Rc8' }
    },
    { 
      moveNumber: 14, 
      white: { piece: 'rook', notation: 'Rad1' }, 
      black: { piece: 'queen', notation: 'Qc7' }
    },
    { 
      moveNumber: 15, 
      white: { piece: 'bishop', notation: 'Bg3' }, 
      black: { piece: 'rook', notation: 'Rfe8' }
    },
    { 
      moveNumber: 16, 
      white: { piece: 'pawn', notation: 'Nd2' }, 
      black: { piece: 'bishop', notation: 'Bf8' }
    }
  ],
  currentMove = 5
}) => {
  return (
    <div className="w-full bg-[#1A1D1D] border-b border-black">
      <div 
        className="flex items-center h-[25px] overflow-x-auto whitespace-nowrap touch-pan-x no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {moves.map((move) => (
          <div 
            key={move.moveNumber} 
            className={`flex items-center flex-shrink-0 relative ${move.moveNumber === currentMove ? 'bg-[#474F4F]' : ''}`}
          >
            <span className="text-[#9DA792] text-xs pl-2 pr-1 z-10 w-8">{move.moveNumber}.</span>
            <div className="flex items-center z-10 px-1">
              <div className="flex items-center mr-1">
                {CHESS_PIECES[move.white.piece]}
              </div>
              <span className="text-[#9DA792] text-xs">{move.white.notation}</span>
            </div>
            <div className="flex items-center z-10 px-1 mr-2">
              <div className="flex items-center mr-1">
                {CHESS_PIECES[move.black.piece]}
              </div>
              <span className="text-[#9DA792] text-xs">{move.black.notation}</span>
            </div>
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