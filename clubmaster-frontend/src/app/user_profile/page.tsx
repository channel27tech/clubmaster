"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import profileDataService, { FormattedGameEntry } from "../../utils/ProfileDataService";

// Import formatJoinDate utility, with a fallback implementation
let formatJoinDate: (date?: Date | null) => string;
try {
  // Try to import from utils
  const utils = require("../../utils/date-utils");
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

// We'll keep the static data for recent games and friends for now
const RECENT_GAMES = [
  {
    name: "junaid1414 (143)",
    img: "/images/dp 2.svg",
    icon: "/icons/waiting-clock.svg",
    action: "/icons/Vector_plus_icon.svg",
    analyze: "/icons/forward_arrow.svg",
    bg: "#3A4141",
  },
  {
    name: "Muktanur (256)",
    img: "/images/dp 3.svg",
    icon: "/icons/waiting-clock.svg",
    action: "/icons/Vector_plus_icon.svg",
    analyze: "/icons/forward_arrow.svg",
    bg: "#333939",
  },
  {
    name: "MarcinPawl (587)",
    img: "/images/dp 4.svg",
    icon: "/icons/waiting-clock.svg",
    action: "/icons/Vector_minus_icon.svg",
    analyze: "/icons/forward_arrow.svg",
    bg: "#3A4141",
  },
];
const FRIENDS = [
  { name: "Akhil", img: "/images/dp 2.svg" },
  { name: "Asif", img: "/images/dp 3.svg" },
  { name: "Junaid", img: "/images/dp 4.svg" },
  { name: "Salih", img: "/images/dp 5.svg" },
  { name: "Akhil", img: "/images/dp 2.svg" },
  { name: "Asif", img: "/images/dp 3.svg" },
  { name: "Junaid", img: "/images/dp 4.svg" },
  { name: "Salih", img: "/images/dp 5.svg" },
];

export default function UserProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [userData, setUserData] = useState({
    displayName: '',
    email: '',
    photoURL: '',
    joinDate: new Date(),
    rating: 400, // Default to 1500 instead of 800
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0
  });
  const [gameHistory, setGameHistory] = useState<FormattedGameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Fetch user profile data when component mounts
  useEffect(() => {
    if (user) {
      // Get user data from Firebase auth
      setUserData({
        displayName: user.displayName || 'Chess Player',
        email: user.email || '',
        photoURL: user.photoURL || '/images/dp 1.svg',
        joinDate: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date(),
        rating: 400, // Default to 1500 instead of 800
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDraw: 0
      });
      
      // Fetch additional user data from backend
      fetchUserProfile();
      // Fetch game history
      fetchGameHistory();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch user profile from backend
  const fetchUserProfile = async () => {
    if (!user?.uid) return;
    
    try {
      console.log('Fetching user profile...');
      const userProfileData = await profileDataService.fetchUserProfile(user.uid);
      
      if (userProfileData) {
        setUserData(prev => ({ 
          ...prev, 
          rating: userProfileData.rating || prev.rating,
          displayName: userProfileData.displayName || prev.displayName,
          photoURL: userProfileData.photoURL || prev.photoURL,
          gamesPlayed: userProfileData.gamesPlayed || 0,
          gamesWon: userProfileData.gamesWon || 0,
          gamesLost: userProfileData.gamesLost || 0,
          gamesDraw: userProfileData.gamesDraw || 0
        }));
        console.log('User profile updated:', userProfileData);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch game history from backend
  const fetchGameHistory = async () => {
    if (!user?.uid) return;
    
    try {
      console.log(`Fetching game history for Firebase UID: ${user.uid}`);
      const gameHistoryData = await profileDataService.fetchGameHistory(user.uid);
      
      if (gameHistoryData && gameHistoryData.length > 0) {
        const formattedHistory = profileDataService.formatGameHistory(gameHistoryData);
        setGameHistory(formattedHistory);
        console.log('Game history updated:', formattedHistory);
      } else {
        console.log('No game history found or empty data returned');
        setGameHistory([]);
      }
    } catch (error) {
      console.error('Error fetching game history:', error);
      setGameHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
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
          <span className="text-[#FAF3DD] text-[22px] font-semibold font-poppins">Profile</span>
        </div>
        <button className="ml-2">
          <Image src="/icons/edit-icon.svg" alt="Edit" width={25} height={25} />
        </button>
      </div>
      {/* Profile Section */}
      <div className="flex flex-col items-center w-full mt-12 relative z-10" style={{ maxWidth: 430 }}>
        <div className="relative w-full flex flex-col items-center mb-4 ">
          <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-4 border-[#8FC0A9] bg-[#333939] -mt-8">
            <Image 
              src={userData.photoURL || "/images/dp 1.svg"} 
              alt="Profile" 
              width={100} 
              height={100} 
              className="object-cover w-full h-full"
            />
          </div>
          <span className="mt-4 text-[#FAF3DD] text-[20px] font-medium font-poppins">
            {userData.displayName || "Chess Player"}
          </span>
          <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto mt-2">
            {formatJoinDate(userData.joinDate)}
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[#E9CB6B] text-[15px] font-medium font-roboto">Rating</span>
            <span className="text-[#FAF3DD] text-[20px] font-semibold font-roboto">{userData.rating}</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{userData.gamesPlayed}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Games</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{userData.gamesWon}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Wins</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{userData.gamesLost}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Losses</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">{userData.gamesDraw}</span>
              <span className="text-[#8FC0A9] text-[12px] font-medium font-roboto">Draws</span>
            </div>
          </div>
        </div>
      </div>
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
              {console.log(`Rendering ${gameHistory.length} games in a scrollable container`)}
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
            <Image src="/images/mol_clubmaster_award.svg" alt="Achievement" width={90} height={140} style={{ width: 'auto', height: 'auto' }} />
          </div>
        </div>
      </div>
      {/* Friends Section */}
      <div className="w-full flex flex-col" style={{ maxWidth: 430 }}>
        <div className="flex items-center justify-between px-4 h-[46px] bg-[#1F2323]">
          <span className="text-[#FAF3DD] text-[16px] font-semibold font-roboto">Friends</span>
          <span className="text-[#FAF3DD] text-[15px] font-roboto">5+</span>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4   py-4 bg-[#333939] hide-scrollbar">
          {FRIENDS.map((f, i) => (
            <div key={i} className="flex flex-col mt-3 items-center min-w-[70px]">
              <div className="w-[56px] h-[56px] rounded-full overflow-hidden border-2 border-[#8FC0A9]">
                <Image src={f.img} alt={f.name} width={56} height={56} />
              </div>
              <span className="mt-2 text-[#D9D9D9] text-[13px] font-roboto text-center">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 