'use client';
import React, { useEffect, useState } from 'react';
import { GameResultType, GameEndReason, GameResult } from '../utils/types';
import { fetchGameResult } from '../api/gameApi';
import BetResultDialogueBox, { BetType } from './BetResultDialogueBox';

interface GameResultScreenProps extends Omit<GameResult, 'result' | 'reason' | 'betType'> {
  result: GameResultType;
  reason: GameEndReason;
  gameId: string;
  playerPhotoURL?: string | null;
  opponentPhotoURL?: string | null;
  onClose: () => void;
  // Bet game integration
  isBetGame?: boolean;
  isBetWinner?: boolean;
  betOpponentName?: string;
  onEditProfileClick?: () => void;
  betType?: BetType;
}

const GameResultScreen: React.FC<GameResultScreenProps> = ({
  result,
  reason,
  gameId,
  playerName: initialPlayerName = 'You',
  opponentName: initialOpponentName = 'Opponent',
  playerRating: initialPlayerRating = 1500,
  opponentRating: initialOpponentRating = 1500,
  playerRatingChange: initialPlayerRatingChange = 0,
  opponentRatingChange: initialOpponentRatingChange = 0,
  playerPhotoURL: initialPlayerPhotoURL = null,
  opponentPhotoURL: initialOpponentPhotoURL = null,
  onClose,
  // Bet game props
  isBetGame,
  isBetWinner,
  betOpponentName,
  onEditProfileClick,
  betType,
}) => {
  // State for player data that will be fetched from API
  const [playerName, setPlayerName] = useState<string>(initialPlayerName);
  const [opponentName, setOpponentName] = useState<string>(initialOpponentName);
  const [playerRating, setPlayerRating] = useState<number>(initialPlayerRating);
  const [opponentRating, setOpponentRating] = useState<number>(initialOpponentRating);
  const [playerRatingChange, setPlayerRatingChange] = useState<number>(initialPlayerRatingChange);
  const [opponentRatingChange, setOpponentRatingChange] = useState<number>(initialOpponentRatingChange);
  const [playerPhotoURL, setPlayerPhotoURL] = useState<string | null>(initialPlayerPhotoURL);
  const [opponentPhotoURL, setOpponentPhotoURL] = useState<string | null>(initialOpponentPhotoURL);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Helper function to get the best available profile image
  const getBestProfileImage = (apiImage: string | null | undefined, initialImage: string | null | undefined, defaultLetter: string): string | null => {
    // Check if apiImage is a base64 string (custom uploaded photo)
    const isBase64Image = apiImage?.startsWith('data:image');
    
    // First priority: API provided image that is a base64 string (custom uploaded photo)
    if (apiImage && isBase64Image) {
      console.log(`Using custom uploaded photo for ${defaultLetter}`);
      return apiImage;
    }
    
    // Second priority: API provided image from database (may be from Firebase but chosen by backend)
    if (apiImage) {
      console.log(`Using database photo for ${defaultLetter}`);
      return apiImage;
    }
    
    // Third priority: Initial image (from props, usually from Firebase)
    if (initialImage) {
      console.log(`Using initial photo for ${defaultLetter}`);
      return initialImage;
    }
    
    // No image available
    console.log(`No photo available for ${defaultLetter}, will use fallback`);
    return null;
  };
  
  // Helper function to get the best username to display
  const getBestUsername = (apiUsername: string | null | undefined, initialUsername: string | null | undefined, defaultName: string): string => {
    // First priority: API provided username (from database, which may be custom)
    if (apiUsername && apiUsername !== 'Loading...') {
      console.log(`Using API username: ${apiUsername}`);
      return apiUsername;
    }
    
    // Second priority: Initial username (from props)
    if (initialUsername && initialUsername !== 'Loading...') {
      console.log(`Using initial username: ${initialUsername}`);
      return initialUsername;
    }
    
    // Fallback to default
    console.log(`No valid username found, using default: ${defaultName}`);
    return defaultName;
  };
  
  // Fetch game result data when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!gameId) {
        console.warn('No gameId provided to GameResultScreen');
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('Fetching game result data for gameId:', gameId);
        setIsLoading(true);
        
        // Try to get the game result from localStorage first
        let gameResultData;
        if (typeof window !== 'undefined') {
          const savedResult = localStorage.getItem(`gameResult_${gameId}`);
          if (savedResult) {
            try {
              gameResultData = JSON.parse(savedResult);
              console.log('Using game result from localStorage:', gameResultData);
            } catch (error) {
              console.error('Failed to parse saved game result:', error);
            }
          }
        }
        
        // If not found in localStorage, try the API
        if (!gameResultData) {
          try {
            gameResultData = await fetchGameResult(gameId);
            console.log('Game result data fetched from API:', gameResultData);
          } catch (apiError) {
            console.error('Error fetching game result from API:', apiError);
            // Don't set error state, just use the initial props as fallback
            console.log('Using initial props as fallback for game result');
            setIsLoading(false);
            return;
          }
        }
        
        // Only update state if component is still mounted and we have data
        if (isMounted && gameResultData) {
          // Determine which player is "you" based on the result
          if (result === 'win' && gameResultData.resultType === 'white_win') {
            // You are white and won
            setPlayerName(getBestUsername(
              gameResultData.whitePlayer?.username,
              initialPlayerName,
              'You'
            ));
            setOpponentName(getBestUsername(
              gameResultData.blackPlayer?.username,
              initialOpponentName,
              'Opponent'
            ));
            setPlayerRating(gameResultData.whitePlayer?.rating || initialPlayerRating);
            setOpponentRating(gameResultData.blackPlayer?.rating || initialOpponentRating);
            setPlayerRatingChange(gameResultData.whitePlayer?.ratingChange || initialPlayerRatingChange);
            setOpponentRatingChange(gameResultData.blackPlayer?.ratingChange || initialOpponentRatingChange);
            setPlayerPhotoURL(getBestProfileImage(
              gameResultData.whitePlayer?.photoURL, 
              initialPlayerPhotoURL,
              gameResultData.whitePlayer?.username?.[0] || 'P'
            ));
            setOpponentPhotoURL(getBestProfileImage(
              gameResultData.blackPlayer?.photoURL,
              initialOpponentPhotoURL,
              gameResultData.blackPlayer?.username?.[0] || 'O'
            ));
          } else if (result === 'loss' && gameResultData.resultType === 'black_win') {
            // You are white and lost
            setPlayerName(getBestUsername(
              gameResultData.whitePlayer?.username,
              initialPlayerName,
              'You'
            ));
            setOpponentName(getBestUsername(
              gameResultData.blackPlayer?.username,
              initialOpponentName,
              'Opponent'
            ));
            setPlayerRating(gameResultData.whitePlayer?.rating || initialPlayerRating);
            setOpponentRating(gameResultData.blackPlayer?.rating || initialOpponentRating);
            setPlayerRatingChange(gameResultData.whitePlayer?.ratingChange || initialPlayerRatingChange);
            setOpponentRatingChange(gameResultData.blackPlayer?.ratingChange || initialOpponentRatingChange);
            setPlayerPhotoURL(getBestProfileImage(
              gameResultData.whitePlayer?.photoURL, 
              initialPlayerPhotoURL,
              gameResultData.whitePlayer?.username?.[0] || 'P'
            ));
            setOpponentPhotoURL(getBestProfileImage(
              gameResultData.blackPlayer?.photoURL,
              initialOpponentPhotoURL,
              gameResultData.blackPlayer?.username?.[0] || 'O'
            ));
          } else if (result === 'win' && gameResultData.resultType === 'black_win') {
            // You are black and won
            setPlayerName(getBestUsername(
              gameResultData.blackPlayer?.username,
              initialPlayerName,
              'You'
            ));
            setOpponentName(getBestUsername(
              gameResultData.whitePlayer?.username,
              initialOpponentName,
              'Opponent'
            ));
            setPlayerRating(gameResultData.blackPlayer?.rating || initialPlayerRating);
            setOpponentRating(gameResultData.whitePlayer?.rating || initialOpponentRating);
            setPlayerRatingChange(gameResultData.blackPlayer?.ratingChange || initialPlayerRatingChange);
            setOpponentRatingChange(gameResultData.whitePlayer?.ratingChange || initialOpponentRatingChange);
            setPlayerPhotoURL(getBestProfileImage(
              gameResultData.blackPlayer?.photoURL, 
              initialPlayerPhotoURL,
              gameResultData.blackPlayer?.username?.[0] || 'P'
            ));
            setOpponentPhotoURL(getBestProfileImage(
              gameResultData.whitePlayer?.photoURL,
              initialOpponentPhotoURL,
              gameResultData.whitePlayer?.username?.[0] || 'O'
            ));
          } else if (result === 'loss' && gameResultData.resultType === 'white_win') {
            // You are black and lost
            setPlayerName(getBestUsername(
              gameResultData.blackPlayer?.username,
              initialPlayerName,
              'You'
            ));
            setOpponentName(getBestUsername(
              gameResultData.whitePlayer?.username,
              initialOpponentName,
              'Opponent'
            ));
            setPlayerRating(gameResultData.blackPlayer?.rating || initialPlayerRating);
            setOpponentRating(gameResultData.whitePlayer?.rating || initialOpponentRating);
            setPlayerRatingChange(gameResultData.blackPlayer?.ratingChange || initialPlayerRatingChange);
            setOpponentRatingChange(gameResultData.whitePlayer?.ratingChange || initialOpponentRatingChange);
            setPlayerPhotoURL(getBestProfileImage(
              gameResultData.blackPlayer?.photoURL, 
              initialPlayerPhotoURL,
              gameResultData.blackPlayer?.username?.[0] || 'P'
            ));
            setOpponentPhotoURL(getBestProfileImage(
              gameResultData.whitePlayer?.photoURL,
              initialOpponentPhotoURL,
              gameResultData.whitePlayer?.username?.[0] || 'O'
            ));
          } else {
            // Draw or other result - use default mapping
            setPlayerName(getBestUsername(
              gameResultData.whitePlayer?.username,
              initialPlayerName,
              'You'
            ));
            setOpponentName(getBestUsername(
              gameResultData.blackPlayer?.username,
              initialOpponentName,
              'Opponent'
            ));
            setPlayerRating(gameResultData.whitePlayer?.rating || initialPlayerRating);
            setOpponentRating(gameResultData.blackPlayer?.rating || initialOpponentRating);
            setPlayerRatingChange(gameResultData.whitePlayer?.ratingChange || initialPlayerRatingChange);
            setOpponentRatingChange(gameResultData.blackPlayer?.ratingChange || initialOpponentRatingChange);
            setPlayerPhotoURL(getBestProfileImage(
              gameResultData.whitePlayer?.photoURL,
              initialPlayerPhotoURL,
              gameResultData.whitePlayer?.username?.[0] || 'P'
            ));
            setOpponentPhotoURL(getBestProfileImage(
              gameResultData.blackPlayer?.photoURL,
              initialOpponentPhotoURL,
              gameResultData.blackPlayer?.username?.[0] || 'O'
            ));
          }
          
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Error in game result data processing:', err);
        if (isMounted) {
          // Don't set error state, just use the initial props as fallback
          console.log('Using initial props as fallback due to error');
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [gameId, result, initialPlayerName, initialOpponentName, initialPlayerRating, initialOpponentRating, 
      initialPlayerRatingChange, initialOpponentRatingChange, initialPlayerPhotoURL, initialOpponentPhotoURL]);

  console.log("The current value of isBetGame is: ", isBetGame);
  
  // Log current state
  console.log('GameResultScreen state:', {
    result,
    reason,
    gameId,
    playerName,
    opponentName,
    playerRating,
    opponentRating,
    playerRatingChange,
    opponentRatingChange,
    playerPhotoURL,
    opponentPhotoURL,
    isLoading,
    error
  });
  // Get title text based on result
  const getTitleText = (): string => {
    // Add safety check for resignations
    if (reason === 'resignation') {
      return result === 'win' ? 'Congratulations!' : 'Game Over';
    }

    if (result === 'win') return 'Congratulations!';
    if (result === 'loss') return 'Better luck next time';
    if (reason === 'abort') return 'Game Aborted';
    
    // Only use Game Drawn when we're sure it's a draw
    if (result === 'draw') return 'Game Drawn';
    
    // Use a generic fallback for unknown states
    return 'Game Over';
  };

  // Get secondary text based on result
  const getSecondaryText = (): string => {
    // Handle specific game end reasons with clear messages
    switch (reason) {
      case 'checkmate':
        return result === 'win' ? 'YOU WON BY CHECKMATE' : 'YOU LOST BY CHECKMATE';
      
      case 'resignation':
        return result === 'win' ? 'OPPONENT RESIGNED' : 'YOU RESIGNED';
      
      case 'timeout':
        return result === 'win' ? 'OPPONENT RAN OUT OF TIME' : 'YOU RAN OUT OF TIME';
      
      case 'draw_agreement':
        return 'DRAW BY AGREEMENT';
      
      case 'stalemate':
        return 'DRAW BY STALEMATE';
      
      case 'insufficient_material':
        return 'DRAW BY INSUFFICIENT MATERIAL';
      
      case 'threefold_repetition':
        return 'DRAW BY REPETITION';
      
      case 'fifty_move_rule':
        return 'DRAW BY 50-MOVE RULE';
      
      case 'abort':
        return 'GAME ABORTED';
      
      default:
        // Generic fallbacks based on result
        if (result === 'win') return 'YOU WON';
        if (result === 'loss') return 'YOU LOST';
        if (result === 'draw') return 'DRAW';
        return 'GAME COMPLETE';
    }
  };

  // Get color for the result header
  const getResultColor = (): string => {
    if (result === 'win') return 'bg-[#4A7C59]'; // Green for win
    if (result === 'loss') return 'bg-[#C25450]'; // Red for loss
    if (reason === 'abort') return 'bg-[#6B717E]'; // Dark gray for aborted game
    return 'bg-[#8A9199]'; // Gray for draw
  };

  // Get rating display
  const getRatingDisplay = (): { rating: number, change: number } => {
    // Always show player's rating regardless of result
    return { rating: playerRating, change: playerRatingChange };
  };

  const ratingInfo = getRatingDisplay();

  // Get score display for the result banner
  const getScoreDisplay = (): string => {
    // Specific handling for aborted games - show score as 0-0 instead of 'Aborted'
    // This ensures consistent layout with other game end conditions
    if (reason === 'abort') return '0 - 0';
    
    // Specific handling for resignations to ensure correct score display
    if (reason === 'resignation') {
      if (result === 'win') return '1 - 0';
      if (result === 'loss') return '0 - 1';
      // Fallback for unknown state in resignations (should never happen)
      console.warn('Resignation with unknown result type:', result);
      return '? - ?';
    }
    
    if (result === 'win') return '1 - 0';
    if (result === 'loss') return '0 - 1';
    if (result === 'draw') return '½ - ½'; // Draw
    
    // Generic fallback
    return '? - ?';
  };

  // Debug log for diagnosing rendering issues
  console.log('GameResultScreen rendering with:', {
    result,
    reason,
    title: getTitleText(),
    secondaryText: getSecondaryText(),
    scoreDisplay: getScoreDisplay()
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[6px]"></div>
      
      {/* Modal content */}
      <div className="relative z-10 bg-[#333939] rounded-lg shadow-xl overflow-hidden w-full max-w-[388px]">
        {/* Curved header with proper spacing */}
        <div className="relative flex justify-center">
          {/* Background color div with curved bottom edges */}
          <div className={`absolute top-0 left-8 right-8 h-20 ${getResultColor()} rounded-b-[90px]`}></div>
          
          {/* Content positioned over the background */}
          <div className="relative z-10 px-4 py-4 flex flex-col items-center">
            <h2 className="text-white text-lg font-bold mb-1">{getTitleText()}</h2>
            <p className="text-[#E9CB6B] text-base font-semibold">{getSecondaryText()}</p>
          </div>
        </div>

        {/* Players information - adjusted for spacing after header */}
        <div className="p-4 pt-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-8 h-8 border-4 border-[#4A7C59] border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-[#F9F3DD] text-sm">Loading player data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <p className="text-[#F9F3DD] text-xs">Using fallback data</p>
            </div>
          ) : (
            <>
              {/* Game result with player profiles */}
              <div className="flex justify-between items-center mb-4">
                {/* Player (You) */}
                <div className="flex flex-col items-center mx-4">
                  {playerPhotoURL ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden mb-2 border-2 border-[#F9F3DD]">
                      <img 
                        src={playerPhotoURL} 
                        alt={`${playerName}'s avatar`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If image fails to load, replace with fallback
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center bg-[#4A7C59] text-white text-lg font-bold">
                              ${playerName.charAt(0).toUpperCase()}
                            </div>
                          `;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 flex items-center justify-center bg-[#4A7C59] rounded-lg text-white text-lg font-bold mb-2 border-2 border-[#F9F3DD]">
                      {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
                    </div>
                  )}
                  <p className="text-[#F9F3DD] text-sm font-semibold">
                    {playerName || 'Player'}
                  </p>
                </div>

                {/* Score */}
                <div className="text-2xl font-bold text-[#F9F3DD] mx-3">
                  {getScoreDisplay()}
                </div>

                {/* Opponent */}
                <div className="flex flex-col items-center mx-4">
                  {opponentPhotoURL ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden mb-2 border-2 border-[#F9F3DD]">
                      <img 
                        src={opponentPhotoURL} 
                        alt={`${opponentName}'s avatar`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If image fails to load, replace with fallback
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center bg-[#C25450] text-white text-lg font-bold">
                              ${opponentName.charAt(0).toUpperCase()}
                            </div>
                          `;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 flex items-center justify-center bg-[#C25450] rounded-lg text-white text-lg font-bold mb-2 border-2 border-[#F9F3DD]">
                      {opponentName ? opponentName.charAt(0).toUpperCase() : 'O'}
                    </div>
                  )}
                  <p className="text-[#F9F3DD] text-sm font-semibold">
                    {opponentName || 'Opponent'}
                  </p>
                </div>
              </div>

              {/* Rating information - showing the player's rating + change */}
              <div className="flex justify-center items-center mb-4">
                <span className="text-[#F9F3DD] text-sm mr-2">RATING:</span>
                <span className="text-[#F9F3DD] text-sm font-semibold">
                  {ratingInfo.rating}
                </span>
                <span className={`text-sm ${ratingInfo.change >= 0 ? 'text-green-500' : 'text-red-500'} font-bold ml-1`}>
                  {ratingInfo.change >= 0 ? `+${ratingInfo.change}` : ratingInfo.change}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bet-specific dialogue box - only for bet games */}
        {isBetGame && (
          <BetResultDialogueBox
            isWinner={!!isBetWinner}
            opponentName={betOpponentName || 'Opponent'}
            onEditProfileClick={onEditProfileClick}
            betType={betType}
            result={result as 'win' | 'loss' | 'draw'}
          />
        )}

        {/* Action buttons */}
        <div className="px-4 pb-4">
          {/* Rematch button (primary) */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#3D563B] transition-colors mb-3 font-medium"
          >
            Rematch
          </button>
          
          {/* Two action buttons in a row */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3 border border-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#333939] transition-colors font-medium"
            >
              Share
            </button>
            <button
              onClick={onClose}
              className="py-3 border border-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#333939] transition-colors font-medium"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameResultScreen; 