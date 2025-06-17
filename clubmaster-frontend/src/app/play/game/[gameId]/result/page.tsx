"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GameResultScreen from "@/app/components/GameResultScreen";
import { useSocket } from "@/context/SocketContext";
import { GameResult, GameResultType, GameEndReason } from "@/app/utils/types";
import Link from "next/link";
import { getBetResult } from '@/services/betResultService';

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

  const [betGameInfo, setBetGameInfo] = useState<{
    isBetGame: boolean;
    isBetWinner?: boolean;
    betType?: string;
    betOpponentName?: string;
    onEditProfileClick?: (() => void);
  }>({
    isBetGame: false,
  });

  useEffect(() => {
    // If we have game end data, use it to populate the result
    if (gameEndData) {
      const result = gameEndData.winner === 'you' ? 'win' : 
                   gameEndData.winner === 'opponent' ? 'loss' : 'draw';
      
      const baseResult: GameResult = {
        result: result as GameResultType,
        reason: (gameEndData.reason || 'checkmate') as GameEndReason,
        playerName: gameEndData.playerName || 'You',
        opponentName: gameEndData.opponentName || 'Opponent',
        playerRating: gameEndData.playerRating || 1500,
        opponentRating: gameEndData.opponentRating || 1500,
        playerRatingChange: gameEndData.playerRatingChange || (result === 'win' ? 10 : (result === 'loss' ? -10 : 0)),
        opponentRatingChange: gameEndData.opponentRatingChange || (result === 'loss' ? 10 : (result === 'win' ? -10 : 0))
      };
      setGameResult(baseResult);
    } else {
      // If no game end data, try to load from localStorage
      if (typeof window !== 'undefined') {
        const savedResult = localStorage.getItem(`gameResult_${gameId}`);
        if (savedResult) {
          try {
            const parsedResult = JSON.parse(savedResult);
            setGameResult(parsedResult);
          } catch (error) {
            console.error('Failed to parse saved game result:', error);
          }
        }
      }
    }
  }, [gameEndData, gameId]);

  useEffect(() => {
    if (gameId) {
      const betResult = getBetResult(gameId);
      let currentUserId = null;
      if (typeof window !== 'undefined') {
        currentUserId = localStorage.getItem('backendUserId');
      }
      console.log('[DEBUG] betResult:', betResult);
      console.log('[DEBUG] backendUserId:', currentUserId);

      if (betResult && currentUserId) {
        const isWinner = betResult.winnerId === currentUserId;
        setBetGameInfo({
          isBetGame: true,
          isBetWinner: isWinner,
          betType: betResult.betType,
          betOpponentName: isWinner ? betResult.loserName : betResult.winnerName,
          onEditProfileClick: isWinner ? () => alert('Edit Profile Clicked!') : undefined,
        });
      } else {
        setBetGameInfo({
          isBetGame: false,
        });
      }
    }
  }, [gameId, gameResult]);

  // Log the final props passed to GameResultScreen
  useEffect(() => {
    console.log('GameResultScreen props:', gameResult);
  }, [gameResult]);

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
        playerPhotoURL={gameResult.playerPhotoURL}
        opponentPhotoURL={gameResult.opponentPhotoURL}
        gameId={gameId}
        onClose={handleClose}
        // Bet game props
        isBetGame={betGameInfo.isBetGame}
        isBetWinner={betGameInfo.isBetWinner}
        betType={betGameInfo.betType}
        betOpponentName={betGameInfo.betOpponentName}
        onEditProfileClick={betGameInfo.onEditProfileClick}
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