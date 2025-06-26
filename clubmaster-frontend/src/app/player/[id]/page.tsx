"use client";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import profileDataService, { FormattedGameEntry } from "../../../utils/ProfileDataService";
import type { UserProfile } from "../../../utils/ProfileDataService";
import { checkIfFriends, addFriend, checkPendingRequest } from "../../../utils/friendUtils";

// Import formatJoinDate utility, with a fallback implementation
let formatJoinDate: (date?: Date | null) => string;
try {
  // Try to import from utils
  const utils = require("../../../utils/date-utils");
  formatJoinDate = utils.formatJoinDate;
} catch (error) {
  // Fallback implementation if import fails
  formatJoinDate = (date?: Date | null): string => {
    if (!date) return "Joined recently";
    const formatter = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    return `Joined ${formatter.format(date)}`;
  };
}

export default function PlayerProfile() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [playerData, setPlayerData] = useState({
    displayName: '',
    email: '',
    photoURL: '',
    joinDate: new Date(),
    rating: 400,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0
  });
  const [playerProfileData, setPlayerProfileData] = useState<UserProfile | null>(null);
  const [gameHistory, setGameHistory] = useState<FormattedGameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const playerId = params.id as string;

  // Check if the current user is viewing their own profile
  const isOwnProfile = user?.uid === playerId;

  // Fetch player profile data when component mounts
  useEffect(() => {
    if (playerId) {
      console.log('Fetching data for player ID:', playerId);
      fetchPlayerProfile();
      fetchGameHistory();
    } else {
      setIsLoading(false);
    }
  }, [playerId]);

  // Check if the player is already a friend or has a pending request
  useEffect(() => {
    const checkFriendStatus = async () => {
      if (user?.uid && playerId && user.uid !== playerId) {
        try {
          // Check if they are already friends
          const areFriends = await checkIfFriends(user.uid, playerId);
          setIsFriend(areFriends);
          
          // If not friends, check if there's a pending request
          if (!areFriends) {
            const isPending = await checkPendingRequest(playerId);
            setIsRequestPending(isPending);
          }
        } catch (error) {
          console.error('Error checking friend status:', error);
        }
      }
    };
    
    checkFriendStatus();
  }, [user, playerId]);

  // Fetch player profile from backend
  const fetchPlayerProfile = async () => {
    if (!playerId) return;
   
    try {
      console.log('Fetching player profile...', playerId);
      
      // Direct API call to fetch the other player's profile
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/profile/${playerId}`);
      
      if (response.status === 404) {
        console.warn(`Player not found for ID: ${playerId}`);
        setIsLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch player profile: ${response.statusText}`);
      }
      
      const profileData = await response.json();
      
      if (profileData) {
        // Store the complete profile data
        setPlayerProfileData(profileData);
        
        // Update the UI state
        setPlayerData({
          displayName: profileData.username || profileData.displayName || 'Chess Player',
          email: profileData.email || '',
          photoURL: profileData.effective_photo_url || profileData.photoURL || '/images/dp 1.svg',
          joinDate: profileData.joinDate ? new Date(profileData.joinDate) : new Date(),
          rating: profileData.rating || 1500,
          gamesPlayed: profileData.gamesPlayed || 0,
          gamesWon: profileData.gamesWon || 0,
          gamesLost: profileData.gamesLost || 0,
          gamesDraw: profileData.gamesDraw || 0
        });
      }
    } catch (error) {
      console.error('Error fetching player profile:', error);
    } finally {
      setIsLoading(false);
    }
  };
 
  // Fetch game history from backend
  const fetchGameHistory = async () => {
    if (!playerId) return;
   
    try {
      console.log(`Fetching game history for player ID: ${playerId}`);
      
      // Direct API call to fetch the player's game history
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/profile/${playerId}/games`);
      
      if (response.status === 404) {
        console.warn(`Player not found for ID: ${playerId}, returning empty game history`);
        setGameHistory([]);
        setIsLoadingHistory(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch game history: ${response.statusText}`);
      }
      
      const gameHistoryData = await response.json();
      
      if (gameHistoryData && gameHistoryData.length > 0) {
        const formattedHistory = profileDataService.formatGameHistory(gameHistoryData);
        setGameHistory(formattedHistory);
      } else {
        setGameHistory([]);
      }
    } catch (error) {
      console.error('Error fetching game history:', error);
      setGameHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle add friend
  const handleAddFriend = async () => {
    if (!user || !playerId) return;
    
    try {
      // Log player ID for debugging
      console.log('Attempting to add friend with ID:', playerId);
      console.log('Player ID type:', typeof playerId);
      console.log('Player ID length:', playerId.length);
      console.log('Current user ID:', user.uid);
      
      // Ensure we're not trying to add ourselves
      if (user.uid === playerId) {
        console.warn('Cannot add yourself as a friend');
        return;
      }
      
      // Call API to add friend
      console.log('Calling addFriend utility...');
      const success = await addFriend(playerId);
      
      if (success) {
        console.log('Successfully sent friend request');
        // Only set the request as pending, not as friends yet
        setIsRequestPending(true);
      } else {
        console.error('Failed to send friend request - returned false');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  // Handle challenge
  const handleChallenge = () => {
    if (!playerId) return;
    
    // Navigate to match setup screen with this player as opponent
    router.push(`/bet/match_setup_screen?opponent=${encodeURIComponent(playerData.displayName)}&opponentId=${encodeURIComponent(playerId)}`);
  };
 
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#333939" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E9CB6B]"></div>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen w-full flex flex-col items-center" style={{ background: "#333939" }}>
      {/* Green Curved SVG Background */}
      <div className="w-full absolute top-0 left-0 z-0">
        <svg width="100%" height="140" viewBox="0 0 1440 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 0H1440V90Q720 220 0 90V0Z" fill="#4A7C59"/>
        </svg>
      </div>
      {/* Header */}
      <div className="w-full flex items-center px-4 pt-4 pb-4 relative z-10" style={{ maxWidth: 430 }}>
        <button onClick={() => router.back()} className="mr-2">
          <svg width="25" height="25" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 16L8.5 11L13.5 6" stroke="#FAF3DD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <span className="text-[#FAF3DD] text-[22px] font-semibold font-poppins">Player Profile</span>
        </div>
        <div className="ml-2 w-[25px]"></div> {/* Empty div for spacing */}
      </div>
      {/* Profile Section */}
      <div className="flex flex-col items-center w-full mt-12 relative z-10" style={{ maxWidth: 430 }}>
        <div className="relative w-full flex flex-col items-center mb-4 ">
          <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-4 border-[#8FC0A9] bg-[#333939] -mt-8">
            <Image
              src={playerProfileData?.effective_photo_url || playerProfileData?.photoURL || playerData.photoURL || "/images/dp 1.svg"}
              alt="Profile"
              width={100}
              height={100}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="mt-4 text-[#FAF3DD] text-[20px] font-medium font-poppins">
            {playerProfileData?.username || playerProfileData?.displayName || playerData.displayName || "Chess Player"}
          </span>
          <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto mt-2">
            {formatJoinDate(playerData.joinDate)}
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[#E9CB6B] text-[15px] font-medium font-roboto">Rating</span>
            <span className="text-[#FAF3DD] text-[20px] font-semibold font-roboto">{playerData.rating}</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{playerData.gamesPlayed}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Games</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{playerData.gamesWon}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Wins</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{playerData.gamesLost}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Losses</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{playerData.gamesDraw}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Draws</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isOwnProfile && (
        <div className="w-full flex justify-center gap-4 px-4 mb-4" style={{ maxWidth: 430 }}>
          {/* Only show the Add Friend button if they are not friends and don't have a pending request */}
          {!isFriend && (
            <button 
              onClick={handleAddFriend}
              disabled={isRequestPending}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md border-2 ${
                isRequestPending 
                  ? 'border-[#E9CB6B] bg-[#3A4141] text-[#E9CB6B]' 
                  : 'border-[#8FC0A9] bg-[#333939] text-[#FAF3DD] hover:bg-[#3A4141]'
              } transition-colors`}
            >
              <Image 
                src={isRequestPending ? "/icons/user-clock.svg" : "/icons/user-plus.svg"} 
                alt={isRequestPending ? "Pending" : "Add Friend"} 
                width={20} 
                height={20} 
              />
              <span>{isRequestPending ? 'Request Sent' : 'Add Friend'}</span>
            </button>
          )}
          
          {/* Always show the Challenge button */}
          <button 
            onClick={handleChallenge}
            className={`${isFriend ? 'flex-1' : ''} flex items-center justify-center gap-2 py-3 px-4 rounded-md border-2 border-[#8FC0A9] bg-[#333939] text-[#FAF3DD] hover:bg-[#3A4141] transition-colors`}
          >
            <Image src="/icons/chess-knight.svg" alt="Challenge" width={20} height={20} />
            <span>Challenge</span>
          </button>
        </div>
      )}

      {/* Game History Section */}
      <div className="w-full flex flex-col mt-4" style={{ maxWidth: 430 }}>
        <div className="flex items-center justify-between px-4 h-[46px] bg-[#1F2323]">
          <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">Game History</span>
          <Image src="/icons/forward_arrow.svg" alt="Arrow" width={15} height={15} style={{ width: 'auto', height: 'auto' }} />
        </div>
        {/* Scrollable container with fixed height for 5 rows */}
        <div className="flex flex-col" style={{
          height: '200px',  
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f1f1f1'
        }}>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-[100px] bg-[#3A4141]">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E9CB6B]"></div>
            </div>
          ) : gameHistory.length > 0 ? (
            <>
              {/* Rendering game history */}
              {gameHistory.map((game, i) => (
                <div key={game.id} className="flex flex-col px-4 py-3" style={{ background: i % 2 === 0 ? '#3A4141' : '#333939' }}>
                  <div className="flex items-center">
                    {/* Time Control Icon */}
                    <div className="mr-2 flex items-center justify-center">
                      <Image
                        src={game.timeControlIcon}
                        alt={`${game.timeControlCategory} Icon`}
                        width={20}
                        height={20}
                        style={{ width: 'auto', height: '20px', marginRight: '8px' }}
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[#D9D9D9] text-[14px] font-roboto">
                          vs {game.opponent} ({game.opponentRating})
                        </span>
                        <span className="text-[#8FC0A9] text-[12px] font-roboto">{game.date}</span>
                      </div>
                      <div className="flex items-center justify-between w-full mt-1">
                        <span
                          className={`text-[13px] font-roboto ${game.resultColor === 'green' ? 'text-[#8FC0A9]' :
                            game.resultColor === 'red' ? 'text-[#E07A5F]' : 'text-[#E9CB6B]'}`}>
                          <span className="font-bold">{game.resultIcon}</span>
                          {game.result}
                        </span>
                        <span className="text-[#D9D9D9] text-[12px] font-roboto">{game.moveCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-center h-[100px] bg-[#3A4141]">
              <span className="text-[#D9D9D9] text-[14px] font-roboto">No game history available</span>
            </div>
          )}
        </div>
      </div>
      {/* Achievements Section */}
      <div className="w-full flex flex-col " style={{ maxWidth: 430 }}>
        <div className="flex items-center px-4 h-[46px] bg-[#1F2323]">
          <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">Achievements</span>
        </div>
        <div className="flex items-center px-4 py-4  bg-[#333939]">
          <div className="w-[90px] h-[120px] rounded-[8px] overflow-hidden flex items-center justify-center">
            <Image
              src="/images/mol_clubmaster_award.svg"
              alt="Achievement"
              width={90}
              height={140}
              className="w-auto h-auto max-w-full max-h-full"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 