'use client';

import { useState, useRef, useCallback } from 'react';
import ChessSquare from './ChessSquare';
import PromotionSelector from './PromotionSelector';
import { MoveHistoryState, PieceType, PieceColor, generateNotation } from '../utils/moveHistory';
import { makeMove, getGameStatus, getCurrentBoardState } from '../utils/chessEngine';
import { findMovingPiece } from '../utils/boardHelpers';

// Import custom hooks
import useChessHistory from '../hooks/useChessHistory';
import useChessPromotion from '../hooks/useChessPromotion';
import useBoardSync from '../hooks/useBoardSync';
import useChessMultiplayer from '../hooks/useChessMultiplayer';
import useChessMove from '../hooks/useChessMove';

interface ChessBoardProps {
  perspective?: 'white' | 'black';
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
  playerColor?: 'white' | 'black' | null;
  gameId?: string; // ID of the current game for socket communications
}

const ChessBoard = ({ perspective = 'white', onMoveHistoryChange, playerColor, gameId }: ChessBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');

  // Use our custom hooks
  const {
    moveHistory,
    boardState,
    lastMove,
    updateMoveHistory,
    updateBoardState,
    setLastMove,
    goBack: handleGoBack,
    goForward: handleGoForward
  } = useChessHistory(onMoveHistoryChange);

  const {
    showPromotion,
    promotionMove,
    showPromotionSelector,
    hidePromotionSelector
  } = useChessPromotion();

  // Board sync hook - monitoring for consistency
  // We're not directly using the returned methods but the hook itself has side effects
  useBoardSync({ boardState });

  // Handle promotion needed callback - Cast boardRef to match the expected type
  const handlePromotionNeeded = useCallback((from: string, to: string, piece: { type: PieceType, color: PieceColor }) => {
    // Make sure boardRef exists before calling the selector
    if (boardRef.current) {
      // Type assertion to match the expected RefObject<HTMLDivElement> type
      const typedRef = boardRef as React.RefObject<HTMLDivElement>;
      showPromotionSelector(from, to, piece, typedRef, perspective);
    }
  }, [boardRef, perspective, showPromotionSelector]);

  // Chess move hook
  const {
    selectedSquare,
    legalMoves,
    selectSquare,
    clearSelection,
    makePlayerMove
  } = useChessMove({
    boardState,
    currentPlayer,
    playerColor,
    onPromotionNeeded: handlePromotionNeeded
  });

  // Multiplayer hook - Extract only what we need
  const { sendMove } = useChessMultiplayer({
    gameId,
    playerColor,
    boardState,
    moveHistory,
    onBoardStateUpdate: updateBoardState,
    onMoveHistoryUpdate: updateMoveHistory,
    onLastMoveUpdate: setLastMove,
    onPlayerTurnChange: setCurrentPlayer
  });

  // Handle square click
  const handleSquareClick = (position: string, piece: { type: PieceType, color: PieceColor } | null) => {
    // If we're in replay mode, don't allow moves
    if (moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0) {
      return;
    }
    
    // Debug logs
    console.log("CLICK - playerColor:", playerColor, "currentPlayer:", currentPlayer);
    
    // If a square was already selected (making a move)
    if (selectedSquare) {
      // Check if the clicked square is in legal moves
      if (legalMoves.includes(position)) {
        // Find the piece that's moving
        const movingPiece = findMovingPiece(selectedSquare, boardState);
        
        if (movingPiece) {
          // Try to make the move
          const moveSuccess = makePlayerMove(selectedSquare, position);
          
          if (moveSuccess) {
            // Update board state based on chess.js
            const newBoardState = getCurrentBoardState();
            
            // Check if there's a piece at destination (capture)
            let isCapture = false;
            for (const row of boardState.squares) {
              for (const square of row) {
                if (square.position === position && square.piece) {
                  isCapture = true;
                  break;
                }
              }
            }
            
            // Generate notation for the move
            const notation = generateNotation(selectedSquare, position, movingPiece, isCapture);
            
            // Determine if we're in a rewound state
            const isRewound = moveHistory.currentMoveIndex < moveHistory.moves.length - 1;
            
            // Create a properly trimmed move history
            const updatedMoves = isRewound
              ? moveHistory.moves.slice(0, moveHistory.currentMoveIndex + 1)
              : [...moveHistory.moves];
            
            // Add the new move with its board state
            updatedMoves.push({
              from: selectedSquare,
              to: position,
              piece: movingPiece,
              notation,
              boardState: newBoardState
            });
            
            // Create the new history object
            const newHistory = {
              ...moveHistory,
              moves: updatedMoves,
              currentMoveIndex: updatedMoves.length - 1
            };
            
            // Update state
            updateMoveHistory(newHistory);
            updateBoardState(newBoardState);
            setLastMove({ from: selectedSquare, to: position });
            setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
            
            // Check game status
            const gameStatus = getGameStatus();
            if (gameStatus.isGameOver) {
              // Handle game over
              console.log('Game over:', gameStatus);
            }
            
            // Send this move to other players
            sendMove(
              selectedSquare, 
              position, 
              movingPiece, 
              notation
            );
          }
        }
      }
      
      // Clear selection
      clearSelection();
    } 
    // If no square was selected and the player clicked on a piece
    else if (piece) {
      selectSquare(position, piece);
    }
  };

  // Handle promotion piece selection
  const handlePromotionSelect = useCallback((promotionPiece: PieceType) => {
    if (!promotionMove) return;

    const { from, to, piece } = promotionMove;

    // Make the move in the local chess engine first
    const moveSuccess = makeMove(from, to, promotionPiece);

    if (moveSuccess) {
      const newBoardState = getCurrentBoardState();
      const gameStatus = getGameStatus();
      
      // Determine if it was a capture
      let isCapture = false;
      const toRowIndex = 8 - parseInt(to[1], 10);
      const toColIndex = to.charCodeAt(0) - 'a'.charCodeAt(0);
      if (boardState.squares[toRowIndex] && 
          boardState.squares[toRowIndex][toColIndex] && 
          boardState.squares[toRowIndex][toColIndex].piece) {
        isCapture = true;
      }

      // Generate notation
      const notation = generateNotation(
        from, to, piece, isCapture, promotionPiece, 
        gameStatus.isCheck, gameStatus.isCheckmate
      );
      
      // First, determine if we're in a rewound state
      const isRewound = moveHistory.currentMoveIndex < moveHistory.moves.length - 1;
      
      // Create a properly trimmed move history
      const updatedMoves = isRewound
        ? moveHistory.moves.slice(0, moveHistory.currentMoveIndex + 1)
        : [...moveHistory.moves];
      
      // Add the new move with its board state
      updatedMoves.push({
        from,
        to,
        piece: { type: promotionPiece, color: piece.color },
        notation,
        promotion: promotionPiece,
        boardState: newBoardState
      });

      // Create the new history object
      const newHistory = {
        ...moveHistory,
        moves: updatedMoves,
        currentMoveIndex: updatedMoves.length - 1
      };
      
      // Update state
      updateMoveHistory(newHistory);
      updateBoardState(newBoardState);
      setLastMove({ from, to });
      setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
      
      // Send this promotion move to other players
      sendMove(
        from,
        to,
        piece,
        notation,
        promotionPiece
      );
    }

    hidePromotionSelector();
  }, [
    boardState,
    promotionMove,
    moveHistory,
    updateMoveHistory,
    updateBoardState,
    setLastMove,
    hidePromotionSelector,
    currentPlayer,
    sendMove
  ]);

  // Check if a square is part of the last move
  const isLastMoveSquare = useCallback((position: string) => {
    if (!lastMove) return false;
    return position === lastMove.from || position === lastMove.to;
  }, [lastMove]);

  // Check if a square is selected
  const isSelectedSquare = useCallback((position: string) => {
    return position === selectedSquare;
  }, [selectedSquare]);

  // Check if a square is a legal move destination
  const isLegalMoveSquare = useCallback((position: string) => {
    return legalMoves.includes(position);
  }, [legalMoves]);

  // If perspective is black, reverse the board
  const displayBoard = perspective === 'black' 
    ? [...boardState.squares].reverse().map(row => [...row].reverse()) 
    : boardState.squares;

  return (
    <div className="w-full mx-auto relative">
      {/* Top border for mobile - only shows on small screens */}
      <div className="block sm:hidden h-[13px] bg-[#333939] w-full m-0 p-0"></div>
      
      <div 
        ref={boardRef}
        className={`aspect-square grid grid-cols-8 grid-rows-8 border-0 sm:border-[13px] sm:border-[#333939] sm:rounded-sm shadow-md ${showPromotion ? 'filter blur-sm' : ''}`}
      >
        {displayBoard.map((row, rowIndex) => (
          row.map((square, colIndex) => (
            <ChessSquare
              key={`${rowIndex}-${colIndex}`}
              position={square.position}
              piece={square.piece}
              row={rowIndex}
              col={colIndex}
              isLastMove={isLastMoveSquare(square.position)}
              isSelected={isSelectedSquare(square.position)}
              isLegalMove={isLegalMoveSquare(square.position)}
              onClick={handleSquareClick}
            />
          ))
        ))}
      </div>
      
      {/* Bottom border for mobile - only shows on small screens */}
      <div className="block sm:hidden h-[13px] bg-[#333939] w-full m-0 p-0"></div>
      
      {/* Pawn promotion selector */}
      {showPromotion && promotionMove && (
        <PromotionSelector
          color={promotionMove.piece.color}
          onSelect={handlePromotionSelect}
          position={promotionMove.position}
        />
      )}
      
      {/* Export these controls so parent can use them */}
      <div className="hidden">
        <button onClick={handleGoBack}>Back</button>
        <button onClick={handleGoForward}>Forward</button>
      </div>
    </div>
  );
};

export default ChessBoard; 
