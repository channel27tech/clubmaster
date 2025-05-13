"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GameResultScreen from "@/app/components/GameResultScreen";
import { useSocket } from "@/contexts/SocketContext";
import { GameResult } from "@/app/utils/types";
import Link from "next/link";

export default function GameResultPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  const { gameEndData, resetGameEnd } = useSocket();
  
  const [gameResult, setGameResult] = useState<GameResult>({
    result: 'win',
    reason: 'checkmate',
    playerName: 'Player',
    opponentName: 'Opponent',
    playerRating: 1500,
    opponentRating: 1500,
    playerRatingChange: 10,
    opponentRatingChange: -10
  });

  useEffect(() => {
    // If we have game end data, use it to populate the result
    if (gameEndData) {
      const result = gameEndData.winner === 'you' ? 'win' : 
                   gameEndData.winner === 'opponent' ? 'loss' : 'draw';
      
      setGameResult({
        result,
        reason: gameEndData.reason || 'checkmate',
        playerName: gameEndData.playerName || 'You',
        opponentName: gameEndData.opponentName || 'Opponent',
        playerRating: gameEndData.playerRating || 1500,
        opponentRating: gameEndData.opponentRating || 1500,
        playerRatingChange: gameEndData.playerRatingChange || (result === 'win' ? 10 : (result === 'loss' ? -10 : 0)),
        opponentRatingChange: gameEndData.opponentRatingChange || (result === 'loss' ? 10 : (result === 'win' ? -10 : 0))
      });
    } else {
      // If no game end data, try to load from localStorage
      if (typeof window !== 'undefined') {
        const savedResult = localStorage.getItem(`gameResult_${gameId}`);
        if (savedResult) {
          try {
            setGameResult(JSON.parse(savedResult));
          } catch (error) {
            console.error('Failed to parse saved game result:', error);
          }
        }
      }
    }
  }, [gameEndData, gameId]);

  const handleClose = () => {
    // Reset the game end state in context
    resetGameEnd();
    
    // Navigate back to the play page
    router.push('/play');
  };

  return (
    <div className="relative w-full min-h-screen bg-black bg-opacity-50 flex items-center justify-center">
      <GameResultScreen
        result={gameResult.result}
        reason={gameResult.reason}
        playerName={gameResult.playerName}
        opponentName={gameResult.opponentName}
        playerRating={gameResult.playerRating}
        opponentRating={gameResult.opponentRating}
        playerRatingChange={gameResult.playerRatingChange}
        opponentRatingChange={gameResult.opponentRatingChange}
        onClose={handleClose}
      />
      
      {/* Back to game button - for reviewing the game position */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <Link 
          href={`/play/game/${gameId}`}
          className="py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Game
        </Link>
      </div>
    </div>
  );
} 