'use client';

import React from 'react';

type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
type PieceColor = 'white' | 'black';

interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
  large?: boolean; // Add option for larger pieces (in promotion selector)
}

const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, large = false }) => {
  // Use inline SVGs with custom colors instead of external files
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className={large ? "w-full h-full" : "w-4/5 h-4/5"} style={{ maxWidth: large ? '100%' : '85%' }}>
        <svg
          viewBox="0 0 45 45"
          width="100%"
          height="100%"
          className={`${large ? 'drop-shadow-md' : ''}`}
        >
          {renderPieceSVG(type, color)}
        </svg>
      </div>
    </div>
  );
};

// Function to render the appropriate SVG based on piece type and color
const renderPieceSVG = (type: PieceType, color: PieceColor) => {
  // Colors as per requirements
  const fillColor = color === 'white' ? '#FFFFFF' : '#4C5454';
  const strokeColor = '#1F2323';
  const accentColor = color === 'black' ? '#FAF3DD' : '#1F2323';
  
  switch (type) {
    case 'pawn':
      return (
        <path 
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" 
          fill={fillColor} 
          stroke={strokeColor} 
          strokeWidth="1.5" 
          strokeLinecap="round"
        />
      );
    case 'rook':
      return (
        <g fill={fillColor} fillRule="evenodd" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" strokeLinecap="butt"/>
          <path d="M34 14l-3 3H14l-3-3"/>
          <path d="M31 17v12.5H14V17" strokeLinecap="butt" strokeLinejoin="miter"/>
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
          <path d="M11 14h23" fill="none" strokeLinejoin="miter"/>
        </g>
      );
    case 'knight':
      return (
        <g fill="none" fillRule="evenodd" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill={fillColor}/>
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill={fillColor}/>
          <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill={accentColor} stroke={accentColor}/>
          <path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill={accentColor} stroke={accentColor} strokeWidth="1.49997"/>
          {color === 'black' && <path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill={accentColor} stroke="none"/>}
        </g>
      );
    case 'bishop':
      return (
        <g fill="none" fillRule="evenodd" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <g fill={fillColor} strokeLinecap="butt">
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
            <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
          </g>
          <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke={accentColor} strokeLinejoin="miter"/>
        </g>
      );
    case 'queen':
      return (
        <g fillRule="evenodd" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Better aligned crown points with improved positioning */}
          <path 
            d="M9,12 L9,13 L8,13.5 L8,14.5 L10,15 L9,12 Z" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="0.5"
          />
          <path 
            d="M15,9 L15,10 L14,10.5 L14,11.5 L16,12 L15,9 Z" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="0.5"
          />
          <path 
            d="M22.5,7 L22.5,8 L21.5,8.5 L21.5,9.5 L23.5,10 L22.5,7 Z" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="0.5"
          />
          <path 
            d="M30,9 L30,10 L29,10.5 L29,11.5 L31,12 L30,9 Z" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="0.5"
          />
          <path 
            d="M36,12 L36,13 L35,13.5 L35,14.5 L37,15 L36,12 Z" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="0.5"
          />
          
          {/* Perfectly symmetrical crown spheres */}
          <circle cx="9" cy="12" r="1.8" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="15" cy="9" r="1.8" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="22.5" cy="7" r="1.8" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="30" cy="9" r="1.8" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="36" cy="12" r="1.8" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          
          {/* Enhanced body with more elegant shape */}
          <path 
            d="M9,26 C17.5,24.5 30,24.5 36,26 L38.5,13.5 L31,25 L30.7,10.9 L25.5,24.5 L22.5,10 L19.5,24.5 L14.3,10.9 L14,25 L6.5,13.5 L9,26 Z" 
            strokeLinecap="butt" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="1.5"
          />
          
          {/* Enhanced base with smoother curves */}
          <path 
            d="M9,26 C9,28 10.5,28 11.5,30 C12.5,31.5 12.5,31 12,33.5 C10.5,34.5 10.5,36 10.5,36 C9,37.5 11,38.5 11,38.5 C17.5,39.5 27.5,39.5 34,38.5 C34,38.5 36,37.5 34.5,36 C34.5,36 34.5,34.5 33,33.5 C32.5,31 32.5,31.5 33.5,30 C34.5,28 36,28 36,26 C27.5,24.5 17.5,24.5 9,26 Z" 
            strokeLinecap="butt" 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth="1.5"
          />
          
          {/* Base lines for definition */}
          <path d="M11,38.5 A35,35 0 0,0 34,38.5" fill="none" stroke={strokeColor} strokeLinecap="butt" />
          
          {/* Decorative lines on the base with accent color */}
          <path d="M11,29 A35,35 0 0,1 34,29" fill="none" stroke={accentColor} />
          <path d="M12.5,31.5 h20" fill="none" stroke={accentColor} />
          <path d="M11.5,34.5 h22" fill="none" stroke={accentColor} />
          <path d="M10.5,37.5 h24" fill="none" stroke={accentColor} />
          
          {/* Central decorative gem on the crown */}
          <circle cx="22.5" cy="7" r="0.65" fill={accentColor} stroke={accentColor} strokeWidth="0.3" />
        </g>
      );
    case 'king':
      return (
        <g fill="none" fillRule="evenodd" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter"/>
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill={fillColor} strokeLinecap="butt" strokeLinejoin="miter"/>
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill={fillColor}/>
          <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke={accentColor}/>
        </g>
      );
    default:
      return null;
  }
};

export default ChessPiece; 