// Handle square click
const handleSquareClick = (position: string, piece: { type: PieceType, color: PieceColor } | null) => {
  // If we're in replay mode, don't allow moves
  if (moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0) {
    return;
  }
  
  // Debug logs
  console.log("CLICK - playerColor:", playerColor, "currentPlayer:", currentPlayer);
  
  // Validate that it's the player's turn
  if (playerColor !== currentPlayer) {
    console.log("Not your turn");
    return;
  }

  // If a square was already selected (making a move)
  if (selectedSquare) {
    // Check if the clicked square is in legal moves
    if (legalMoves.includes(position)) {
      // Find the piece that's moving
      const movingPiece = findMovingPiece(selectedSquare, boardState);
      
      if (movingPiece) {
        // Validate the move is legal according to chess rules
        const chess = getChessEngine();
        const moveAttempt = chess.move({
          from: selectedSquare,
          to: position,
          promotion: 'q' // Default to queen for now
        });

        if (!moveAttempt) {
          console.log("Illegal move according to chess rules");
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        // Undo the move since we'll make it through proper channels
        chess.undo();

        // Try to make the move through our move system
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
          
          // Don't update current player here - wait for server confirmation
          
          // Clear selection
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      // If clicking on an invalid square, clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  } else {
    // Selecting a new square
    if (piece && piece.color === playerColor) {
      setSelectedSquare(position);
      // Calculate legal moves for the selected piece
      const chess = getChessEngine();
      const moves = chess.moves({ square: position, verbose: true });
      setLegalMoves(moves.map(move => move.to));
    }
  }
}; 