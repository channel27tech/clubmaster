'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ChessPiece from './ChessPiece';
import PromotionSelector from './PromotionSelector';
import { BoardState, BoardSquare, initializeMoveHistory, MoveHistoryState, goBackOneMove, goForwardOneMove, addMove, generateNotation, PieceType, PieceColor } from '../utils/moveHistory';
import { getChessEngine, resetChessEngine, isLegalMove, makeMove, getGameStatus, getCurrentBoardState, setChessPosition } from '../utils/chessEngine';
import { useSocket } from '../../contexts/SocketContext';

interface ChessBoardProps {
  perspective?: 'white' | 'black';
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
  playerColor?: 'white' | 'black' | null;
  gameId?: string; // ID of the current game for socket communications
}

const ChessBoard = ({ perspective = 'white', onMoveHistoryChange, playerColor, gameId }: ChessBoardProps) => {
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState>(() => initializeMoveHistory());
  const [boardState, setBoardState] = useState<BoardState>(moveHistory.initialBoardState);
  const [lastMove, setLastMove] = useState<{ from: string, to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  
  // Promotion state
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{
    from: string;
    to: string;
    piece: { type: PieceType, color: PieceColor };
    position: { x: number, y: number };
  } | null>(null);

  // Reference to the board element for positioning the promotion selector
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Get socket for remote move updates
  const { socket } = useSocket();
  
  // Initialize the chess engine
  useEffect(() => {
    resetChessEngine();
  }, []);

  // Debug logging for playerColor
  useEffect(() => {
    console.log('ChessBoard received playerColor:', playerColor);
  }, [playerColor]);

  // Debug logging for props
  useEffect(() => {
    console.log('ChessBoard received props:', { playerColor, gameId });
  }, [playerColor, gameId]);

  // Initialize the chess board with pieces in standard positions
  useEffect(() => {
    // Initialize move history
    const initialHistory = initializeMoveHistory();
    setMoveHistory(initialHistory);
    setBoardState(initialHistory.initialBoardState);
    
    // Notify parent component of initial state
      if (onMoveHistoryChange) {
      onMoveHistoryChange(initialHistory);
      }
  }, [onMoveHistoryChange]);
  
  // Listen for opponent moves via socket
  useEffect(() => {
    if (!socket) return;

    // Handle move synchronization issues by adding a board synchronization event
    const handleBoardSync = (data: { fen: string, gameId: string }) => {
      console.log('Received board sync:', data);
      try {
        // Synchronize the board state from the FEN
        const newBoardState = synchronizeBoardFromFen(data.fen);
        
        // Update the board state
        setBoardState(newBoardState);
        console.log('Board synchronized successfully');
        
        // Create a new move history based on this state
        const newHistory = {
          ...moveHistory,
          initialBoardState: newBoardState,
        };
        
        // Update the move history
        setMoveHistory(newHistory);
        
        // Notify the parent
        if (onMoveHistoryChange) {
          onMoveHistoryChange(newHistory);
        }
      } catch (error) {
        console.error('Failed to synchronize board state:', error);
      }
    };

    const handleOpponentMove = (data: { 
      from: string, 
      to: string, 
      player: string, 
      notation: string,
      gameId: string,
      promotion?: PieceType,
      isCapture?: boolean,
      fen?: string
    }) => {
      console.log('Received move from opponent:', data);
      
      // If player colors are set, only process if it's the opponent's move
      if (playerColor && data.player !== playerColor) {
        console.log(`Processing opponent move. Our color: ${playerColor}, move made by: ${data.player}`);
        
        // If FEN is provided, use it for direct synchronization
        if (data.fen) {
          try {
            console.log('Using provided FEN for synchronization:', data.fen);
            
            // Reset the chess engine with the provided FEN first
            resetChessEngine();
            setChessPosition(data.fen);
            
            // Synchronize the board state from the FEN
            const newBoardState = getCurrentBoardState();
            
            // Find the piece that moved based on notation
            let movingPiece: { type: PieceType, color: PieceColor } | null = null;
            
            // Extract piece type from notation (or default to pawn)
            const isPawnMove = !data.notation.match(/^[KQRBN]/);
            
            if (isPawnMove) {
              movingPiece = {
                type: 'pawn',
                color: data.player as PieceColor
              };
            } else {
              const pieceChar = data.notation[0];
              const pieceType = 
                pieceChar === 'K' ? 'king' :
                pieceChar === 'Q' ? 'queen' :
                pieceChar === 'R' ? 'rook' :
                pieceChar === 'B' ? 'bishop' :
                pieceChar === 'N' ? 'knight' : 'pawn';
                
              movingPiece = {
                type: pieceType as PieceType,
                color: data.player as PieceColor
              };
            }
            
            if (movingPiece) {
              // Add the move to history with FEN-derived board state
              const newHistory = addMove(moveHistory, {
                from: data.from,
                to: data.to,
                piece: movingPiece,
                notation: data.notation,
                promotion: data.promotion
              }, newBoardState);
              
              // Update all the state
              setMoveHistory(newHistory);
              setBoardState(newBoardState);
              setLastMove({ from: data.from, to: data.to });
              setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
              
              // Notify parent
              if (onMoveHistoryChange) {
                onMoveHistoryChange(newHistory);
              }
              
              console.log('Successfully synchronized with FEN');
              return;
            }
          } catch (error) {
            console.error('Error synchronizing from FEN, falling back to move application:', error);
          }
        }
        
        // If we don't have FEN or FEN sync failed, try the normal approach
        // Find the piece that moved before making the move
        let movingPiece: { type: PieceType, color: PieceColor } | null = null;
        const infoBeforeMove = [];
        
        // Debug board state
        console.log("Board state before applying move:");
        for (const row of boardState.squares) {
          for (const square of row) {
            if (square.piece) {
              infoBeforeMove.push(`${square.position}: ${square.piece.color} ${square.piece.type}`);
            }
            if (square.position === data.from && square.piece) {
              movingPiece = { ...square.piece };
              console.log(`Found piece at ${data.from}: ${square.piece.color} ${square.piece.type}`);
            }
          }
        }
        console.log(infoBeforeMove.join(', '));
        
        // If we couldn't find the piece on the board but we have notation, try to infer the piece
        if (!movingPiece && data.notation) {
          console.log("Couldn't find piece on board, inferring from notation:", data.notation);
          // Extract piece type and color from notation
          // Most notations start with piece type (except pawns)
          const isCapture = data.isCapture || data.notation.includes('x');
          const isPawnMove = !data.notation.match(/^[KQRBN]/);
          
          if (isPawnMove) {
            movingPiece = {
              type: 'pawn',
              color: data.player as PieceColor
            };
            console.log("Inferred piece from notation: pawn", data.player);
          } else {
            const pieceChar = data.notation[0];
            const pieceType = 
              pieceChar === 'K' ? 'king' :
              pieceChar === 'Q' ? 'queen' :
              pieceChar === 'R' ? 'rook' :
              pieceChar === 'B' ? 'bishop' :
              pieceChar === 'N' ? 'knight' : 'pawn';
              
            movingPiece = {
              type: pieceType as PieceType,
              color: data.player as PieceColor
            };
            console.log(`Inferred piece from notation: ${pieceType} ${data.player}`);
          }
        }
        
        // Handle promotion moves explicitly - make sure the pieceTypeMapping is properly loaded
        const pieceTypeMapping: Record<PieceType, string> = {
          'pawn': 'p',
          'knight': 'n',
          'bishop': 'b',
          'rook': 'r',
          'queen': 'q',
          'king': 'k'
        };
        
        // Attempt to apply the move with multiple fallback strategies
        let moveSuccess = false;
        
        // Reset the chess engine to match our current state before attempting the move
        try {
          const chess = getChessEngine();
          
          // Log the current state for debugging
          console.log('Current board state FEN before move:', chess.fen());
        } catch (error) {
          console.error('Error getting current FEN:', error);
        }
        
        // First try with movingPiece info and promotion
        if (movingPiece) {
          moveSuccess = makeMove(data.from, data.to, data.promotion);
          console.log('First move attempt result:', moveSuccess, 'promotion:', data.promotion);
        }
        
        // If the first attempt failed, try a direct move without pre-validation
        if (!moveSuccess) {
          try {
            console.log('Attempting direct move with chess.js');
            const chess = getChessEngine();
            
            // Create a standard chess.js move object
            const moveObj = {
              from: data.from,
              to: data.to,
              promotion: data.promotion ? pieceTypeMapping[data.promotion] : undefined
            };
            
            console.log('Move object:', moveObj);
            
            // Try to make the move using the chess.js move method
            const result = chess.move(moveObj);
            moveSuccess = !!result;
            console.log('Direct move result:', result);
          } catch (error) {
            console.error('Error making direct move:', error);
          }
        }
        
        // Final attempt: If this is a pawn promotion move but failed, try with default queen promotion
        if (!moveSuccess && movingPiece && movingPiece.type === 'pawn') {
          // Check if this move could be a promotion (pawn moving to last rank)
          const destRank = parseInt(data.to[1]);
          const isPotentialPromotion = 
            (movingPiece.color === 'white' && destRank === 8) || 
            (movingPiece.color === 'black' && destRank === 1);
            
          if (isPotentialPromotion) {
            console.log('Trying backup promotion to queen');
            // Try promoting to queen as fallback
            try {
              const chess = getChessEngine();
              const result = chess.move({
                from: data.from,
                to: data.to,
                promotion: 'q' // Default to queen
              });
              moveSuccess = !!result;
              console.log('Fallback queen promotion result:', result);
              
              // If successful, update the promotion type to queen
              if (moveSuccess) {
                data.promotion = 'queen';
              }
            } catch (error) {
              console.error('Error making fallback promotion move:', error);
            }
          }
        }
        
        if (moveSuccess) {
          console.log('Move successfully applied to board');
          // Get updated board state after move
          const newBoardState = getCurrentBoardState();
          
          if (movingPiece) {
            // Add the move to history, including promotion data if present
            const newHistory = addMove(moveHistory, {
              from: data.from,
              to: data.to,
              piece: movingPiece,
              notation: data.notation,
              promotion: data.promotion
            }, newBoardState);
            
            // Update state
            setMoveHistory(newHistory);
            setBoardState(newBoardState);
            setLastMove({ from: data.from, to: data.to });
            setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
            
            // Notify parent of move history change
            if (onMoveHistoryChange) {
              onMoveHistoryChange(newHistory);
            }
          } else {
            console.error('Could not find moving piece for opponent move');
            
            // Still update board state as a fallback
            setBoardState(newBoardState);
            setLastMove({ from: data.from, to: data.to });
            setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
          }
        } else {
          console.error('Failed to apply opponent move to board');
          // Try to recover by forcing a board synchronization
          console.log('Attempting to synchronize board state');
          
          // Request state synchronization from server
          if (socket && gameId) {
            console.log('Requesting board state synchronization from server');
            socket.emit('request_board_sync', { gameId: data.gameId || gameId });
          }
        }
      }
    };

    socket.on('move_made', handleOpponentMove);
    socket.on('board_sync', handleBoardSync);

    return () => {
      socket.off('move_made', handleOpponentMove);
      socket.off('board_sync', handleBoardSync);
    };
  }, [socket, playerColor, gameId, boardState, moveHistory, onMoveHistoryChange]);

  // Handle going back one move
  const handleGoBack = useCallback(() => {
    const { newHistory, boardState: newBoardState } = goBackOneMove(moveHistory);
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const prevMoveIndex = newHistory.currentMoveIndex;
    if (prevMoveIndex >= 0) {
      const prevMove = newHistory.moves[prevMoveIndex];
      setLastMove({ from: prevMove.from, to: prevMove.to });
    } else {
      setLastMove(null);
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // Handle going forward one move
  const handleGoForward = useCallback(() => {
    const { newHistory, boardState: newBoardState } = goForwardOneMove(moveHistory);
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const nextMoveIndex = newHistory.currentMoveIndex;
    if (nextMoveIndex >= 0) {
      const nextMove = newHistory.moves[nextMoveIndex];
      setLastMove({ from: nextMove.from, to: nextMove.to });
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // Check if a move requires pawn promotion
  const isPawnPromotion = useCallback((from: string, to: string, piece: { type: PieceType, color: PieceColor }) => {
    // Only pawns can be promoted
    if (piece.type !== 'pawn') return false;
    
    // Get the rank (row) of the destination square
    const destRank = parseInt(to[1]);
    
    // White pawns are promoted on rank 8, black pawns on rank 1
    return (piece.color === 'white' && destRank === 8) || 
           (piece.color === 'black' && destRank === 1);
  }, []);

  // Handle promotion piece selection
  const handlePromotionSelect = useCallback((promotionPiece: PieceType) => {
    // Hide promotion selector
    setShowPromotion(false);
    
    if (!promotionMove) return;
    
    const { from, to, piece } = promotionMove;
    
    // Check if there's a piece at the destination (capture)
    let isCapture = false;
    for (const row of boardState.squares) {
      for (const square of row) {
        if (square.position === to && square.piece) {
          isCapture = true;
          break;
        }
      }
    }
    
    // Make the move with promotion
    const moveSuccess = makeMove(from, to, promotionPiece);
    
    if (moveSuccess) {
      // Update board state based on chess.js
      const newBoardState = getCurrentBoardState();
      
      // Add move to history with promotion information
      const notation = generateNotation(from, to, piece, isCapture, promotionPiece);
      const newHistory = addMove(moveHistory, {
        from,
        to,
        piece,
        promotion: promotionPiece,
        notation
      }, newBoardState);
      
      // Update state
      setMoveHistory(newHistory);
      setBoardState(newBoardState);
      setLastMove({ from, to });
      setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
      
      // Notify parent
      if (onMoveHistoryChange) {
        onMoveHistoryChange(newHistory);
      }
      
      // Check game status
      const gameStatus = getGameStatus();
      if (gameStatus.isGameOver) {
        // Handle game over
        console.log('Game over:', gameStatus);
      }
      
      // Get current FEN for synchronization
      let currentFen = '';
      try {
        const chess = getChessEngine();
        currentFen = chess.fen();
      } catch (error) {
        console.error('Error getting FEN:', error);
      }
      
      // Emit this move with promotion info to other players via socket
      if (socket && playerColor === piece.color) {
        socket.emit('move_made', {
          from,
          to,
          player: piece.color,
          notation,
          promotion: promotionPiece,
          isCapture,
          fen: currentFen, // Add FEN for better synchronization
          gameId: gameId || socket.id
        });
      }
    }
    
    // Clear promotion state
    setPromotionMove(null);
  }, [moveHistory, currentPlayer, onMoveHistoryChange, promotionMove, socket, playerColor, boardState.squares, gameId]);

  // Calculate position for promotion selector
  const calculatePromotionPosition = useCallback((position: string) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    
    // Get the file (column) of the position (a-h)
    const file = position.charAt(0);
    // Get the rank (row) of the position (1-8)
    const rank = parseInt(position.charAt(1));
    
    // Convert file to column index (a=0, b=1, etc.)
    const colIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    
    // Get board dimensions
    const boardRect = boardRef.current.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    
    // Calculate x position based on column
    // Adjust if the piece is near the edge to keep the selector on the board
    let adjustedCol = perspective === 'black' ? 7 - colIndex : colIndex;
    
    // If too close to the right edge, shift left
    if (adjustedCol > 5) {
      adjustedCol = 5;
    }
    
    // Calculate x position (centered on the square)
    const x = adjustedCol * squareSize;
    
    return { x, y: 0 };
  }, [perspective]);

  // Handle square click for move selection
  const handleSquareClick = (position: string, piece: { type: PieceType, color: PieceColor } | null) => {
    // If we're in replay mode, don't allow moves
    if (moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0) {
      return;
    }
    
    // Debug logs
    console.log("CLICK - playerColor:", playerColor, "currentPlayer:", currentPlayer);
    
    // If a square was already selected (making a move)
    if (selectedSquare) {
      // PRIMARY RESTRICTION: Only allow players to move their own color
      if (playerColor) {
        // Find the selected piece
        let selectedPiece: { type: PieceType, color: PieceColor } | null = null;
        
        for (const row of boardState.squares) {
          for (const square of row) {
            if (square.position === selectedSquare && square.piece) {
              selectedPiece = square.piece;
              break;
            }
          }
        }
        
        // If we found a piece and it's not the player's color, cancel selection
        if (selectedPiece && selectedPiece.color !== playerColor) {
          console.log(`Cannot move ${selectedPiece.color} pieces when you are ${playerColor}`);
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      }
      
      // Check if the clicked square is in legal moves
      if (legalMoves.includes(position)) {
        // Find the piece that's moving
        let movingPiece: { type: PieceType, color: PieceColor } | null = null;
        
        // Search through boardState to find the piece at selectedSquare
        boardStateLoop:
        for (const row of boardState.squares) {
          for (const square of row) {
            if (square.position === selectedSquare && square.piece) {
              movingPiece = square.piece;
              break boardStateLoop;
            }
          }
        }
        
        if (movingPiece) {
          // Double check the moving piece belongs to current player
          if (movingPiece.color !== currentPlayer) {
            console.log(`Cannot move ${movingPiece.color} pieces on ${currentPlayer}'s turn`);
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
          
          // Check if this move would be a pawn promotion
          if (isPawnPromotion(selectedSquare, position, movingPiece)) {
            // Show promotion selector
            const promotionPos = calculatePromotionPosition(position);
            setPromotionMove({
              from: selectedSquare,
              to: position,
              piece: movingPiece,
              position: promotionPos
            });
            setShowPromotion(true);
          } else {
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
            
          // Try to make the move in chess.js
          const moveSuccess = makeMove(selectedSquare, position);
          
          if (moveSuccess) {
            // Update board state based on chess.js
            const newBoardState = getCurrentBoardState();
            
            // Add move to history
              const notation = generateNotation(selectedSquare, position, movingPiece, isCapture);
            const newHistory = addMove(moveHistory, {
              from: selectedSquare,
              to: position,
              piece: movingPiece,
              notation
            }, newBoardState);
            
            // Update state
            setMoveHistory(newHistory);
            setBoardState(newBoardState);
            setLastMove({ from: selectedSquare, to: position });
            setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
            
            // Notify parent
            if (onMoveHistoryChange) {
              onMoveHistoryChange(newHistory);
            }
            
            // Check game status
            const gameStatus = getGameStatus();
            if (gameStatus.isGameOver) {
              // Handle game over
              console.log('Game over:', gameStatus);
              }
              
              // Get current FEN for synchronization
              let currentFen = '';
              try {
                const chess = getChessEngine();
                currentFen = chess.fen();
              } catch (error) {
                console.error('Error getting FEN:', error);
              }
              
              // Emit this move to other players via socket
              if (socket && playerColor === movingPiece.color) {
                socket.emit('move_made', {
                  from: selectedSquare,
                  to: position,
                  player: movingPiece.color,
                  notation,
                  isCapture,
                  fen: currentFen, // Add FEN for better synchronization
                  gameId: gameId || socket.id
                });
              }
            }
          }
        }
      }
      
      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    } 
    // If no square was selected and the player clicked on a piece (selecting a piece)
    else if (piece) {
      // PRIMARY RESTRICTION: If playerColor is set, only allow selection of that color's pieces
      if (playerColor && piece.color !== playerColor) {
        console.log(`Cannot select ${piece.color} pieces when you are ${playerColor}`);
        return;
      }
      
      // Only allow selection of pieces that match the current turn
      if (piece.color !== currentPlayer) {
        console.log(`Cannot select ${piece.color} pieces on ${currentPlayer}'s turn`);
        return;
      }
      
      // Set the selected square and calculate legal moves
      setSelectedSquare(position);
      
      // Get all legal moves for this piece directly from chess.js
      try {
        // Use standard chess notation for the position
      const legalDestinations: string[] = [];
      
        // Get all legal moves for the current piece
        const chess = getChessEngine();
        const legalMoves = chess.moves({
          square: position as any,
          verbose: true
        }) as any[];
        
        // Extract the destination squares
        if (legalMoves && legalMoves.length > 0) {
          for (const move of legalMoves) {
            if (move && move.to) {
              legalDestinations.push(move.to);
          }
        }
      }
      
      setLegalMoves(legalDestinations);
      } catch (err) {
        console.error("Error calculating legal moves:", err);
        setLegalMoves([]);
      }
    }
  };

  // Determine if a square should be dark or light
  const isSquareDark = (row: number, col: number) => {
    return (row + col) % 2 !== 0;
  };
  
  // Check if a square is part of the last move
  const isLastMoveSquare = (position: string) => {
    if (!lastMove) return false;
    return position === lastMove.from || position === lastMove.to;
  };

  // Check if a square is selected
  const isSelectedSquare = (position: string) => {
    return position === selectedSquare;
  };

  // Check if a square is a legal move destination
  const isLegalMoveSquare = (position: string) => {
    return legalMoves.includes(position);
  };

  // Get the background color for a square
  const getSquareBackground = (row: number, col: number, position: string) => {
    const isDark = isSquareDark(row, col);
    const isLastMove = isLastMoveSquare(position);
    const isSelected = isSelectedSquare(position);
    const isLegalMove = isLegalMoveSquare(position);
    
    if (isSelected) {
      return isDark ? 'bg-blue-700' : 'bg-blue-500';
    } else if (isLegalMove) {
      return isDark ? 'bg-green-700' : 'bg-green-500';
    } else if (isLastMove) {
      return isDark ? 'bg-amber-600' : 'bg-amber-400';
    }
    
    return isDark ? 'bg-[#6D8884]' : 'bg-[#FAF3DD]';
  };

  // If perspective is black, reverse the board
  const displayBoard = perspective === 'black' 
    ? [...boardState.squares].reverse().map(row => [...row].reverse()) 
    : boardState.squares;

  return (
    <div className="w-full mx-auto relative">
      <div 
        ref={boardRef}
        className={`aspect-square grid grid-cols-8 grid-rows-8 border-8 rounded-sm border-[#333939] shadow-md ${showPromotion ? 'filter blur-sm' : ''}`}
      >
        {displayBoard.map((row, rowIndex) => (
          row.map((square, colIndex) => {
            return (
              <div 
                key={`${rowIndex}-${colIndex}`}
                className={`
                  flex items-center justify-center
                  ${getSquareBackground(rowIndex, colIndex, square.position)}
                  cursor-pointer
                `}
                onClick={() => handleSquareClick(square.position, square.piece)}
              >
                {square.piece && (
                  <ChessPiece
                    type={square.piece.type}
                    color={square.piece.color}
                  />
                )}
                {isLegalMoveSquare(square.position) && !square.piece && (
                  <div className="w-3 h-3 rounded-full bg-green-500 opacity-60"></div>
                )}
              </div>
            );
          })
        ))}
      </div>
      
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

// Helper function to simulate moving a piece - kept for reference only
const simulateMove = (
  currentBoardState: BoardState,
  from: string,
  to: string,
  piece: { type: PieceType, color: PieceColor }
): BoardState => {
  // Create a deep copy of the current board state
  const newBoardState = JSON.parse(JSON.stringify(currentBoardState)) as BoardState;
  
  // Find the source and destination squares
  let fromSquare: BoardSquare | null = null;
  let toSquare: BoardSquare | null = null;
  let fromRow = -1, fromCol = -1;
  let toRow = -1, toCol = -1;
  
  // Locate the squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (newBoardState.squares[row][col].position === from) {
        fromSquare = newBoardState.squares[row][col];
        fromRow = row;
        fromCol = col;
      }
      if (newBoardState.squares[row][col].position === to) {
        toSquare = newBoardState.squares[row][col];
        toRow = row;
        toCol = col;
      }
    }
  }
  
  // Check if we found both squares
  if (!fromSquare || !toSquare) {
    console.error('Could not find squares for move');
    return currentBoardState;
  }
  
  // Check if there's a capture
  if (toSquare.piece) {
    const capturedPiece = toSquare.piece;
    const capturedPieceWithId = {
      ...capturedPiece,
      id: `${capturedPiece.color[0]}${capturedPiece.type[0]}${Date.now()}` // Generate a unique ID
    };
    
    // Add to captured pieces
    if (capturedPiece.color === 'white') {
      newBoardState.capturedPieces.white.push(capturedPieceWithId);
    } else {
      newBoardState.capturedPieces.black.push(capturedPieceWithId);
    }
  }
  
  // Move the piece
  newBoardState.squares[toRow][toCol].piece = fromSquare.piece;
  newBoardState.squares[fromRow][fromCol].piece = null;
  
  return newBoardState;
};

// Helper function to fully synchronize the board state from FEN
const synchronizeBoardFromFen = (fen: string): BoardState => {
  try {
    // Reset the chess engine with the provided FEN
    resetChessEngine();
    const chess = getChessEngine();
    
    // Load the FEN into the chess engine
    const loadSuccess = chess.load(fen);
    
    if (!loadSuccess) {
      console.error('Failed to load FEN:', fen);
      return getCurrentBoardState(); // Return current state as fallback
    }
    
    // Get the new board state after successfully loading the FEN
    return getCurrentBoardState();
  } catch (error) {
    console.error('Error synchronizing board from FEN:', error);
    return getCurrentBoardState(); // Return current state as fallback
  }
};

export default ChessBoard; 