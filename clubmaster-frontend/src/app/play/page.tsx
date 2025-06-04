"use client";

import React, { useState, useRef } from 'react';
import MatchmakingManager, { MatchmakingManagerHandle } from '@/app/components/MatchmakingManager';
import WaitingScreen from '../components/WaitingScreen';
import { FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Head from "next/head";

// Define the window interface to properly type the window extensions
interface ExtendedWindow extends Window {
  initTwilio?: () => void;
  twilioInitialized?: boolean;
}

declare let window: ExtendedWindow;

// Map time values to game modes for consistency
const getGameModeFromTime = (timeInMinutes: number): string => {
  if (timeInMinutes <= 3) return 'Bullet';
  if (timeInMinutes <= 5) return 'Blitz';
  return 'Rapid';
};

/**
 * Match Setup page component
 * Allows users to select game mode, time control, and starting side
 */
const PlayPage: React.FC = () => {
  const matchmakingRef = useRef<MatchmakingManagerHandle>(null);
  const [activeTab, setActiveTab] = useState<string>('Rapid');
  const [selectedTime, setSelectedTime] = useState<number>(10);
  const [playAs, setPlayAs] = useState<string>('white');
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const router = useRouter();
  
  // State for the notification info popup
  const [notificationInfoPopup, setNotificationInfoPopup] = useState<null | 0 | 1 | 2>(null);

  // Function to get time value based on game mode
  const getTimeFromGameMode = (mode: string): number => {
    switch (mode.toLowerCase()) {
      case 'bullet':
        return 3;
      case 'blitz':
        return 5;
      case 'rapid':
        return 10;
      default:
        return 5;
    }
  };

  // Set the appropriate time when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedTime(getTimeFromGameMode(tab));
    console.log(`🔄 Tab changed to ${tab}, time set to: ${getTimeFromGameMode(tab)}`);
  };

  // Handle time selection
  const handleTimeSelection = (time: number) => {
    setSelectedTime(time);
    setActiveTab(getGameModeFromTime(time));
    console.log(`🔄 Time changed to ${time}, game mode set to: ${getGameModeFromTime(time)}`);
  };
  
  const handleMatchmakingError = (error: string) => {
    console.error('Matchmaking error:', error);
    setIsMatchmaking(false);
  };

  const handleGameFound = (gameId: string) => {
    console.log('Game found:', gameId);
    router.push(`/play/game/${gameId}`);
  };
  
  const handleStartMatchmaking = () => {
    console.log('Play Random clicked with:', { activeTab, selectedTime, playAs });
    
    const timeForMode = getTimeFromGameMode(activeTab);
    console.log('Time for selected game mode:', timeForMode);
    
    const timeControlStr = `${timeForMode}+0`;
    localStorage.setItem('timeControl', timeControlStr);
    console.log('📝 Stored time control in localStorage:', timeControlStr);
    
    localStorage.setItem('gameMode', activeTab);
    console.log('📝 Stored game mode in localStorage:', activeTab);
    
    setIsMatchmaking(true);
    
    if (matchmakingRef.current) {
      matchmakingRef.current.startMatchmaking(activeTab, String(timeForMode), playAs);
    } else {
      console.error('❌ MatchmakingManager ref not available');
    }
  };

  const handleCancelMatchmaking = () => {
    setIsMatchmaking(false);
    const cancelButton = document.getElementById('cancel-matchmaking-button');
    if (cancelButton) {
      console.log('Found cancel button, clicking it');
      cancelButton.click();
      return;
    }
    
    if (typeof window !== 'undefined' && window.cancelMatchmakingDebug) {
      console.log('Using debug method');
      window.cancelMatchmakingDebug();
    }
  };
  
  // Content for bet information popup
  const bettingPopups = [
    {
      title: "Temporary profile control",
      description: "Win the game to gain temporary control over your opponent's profile for 24 hours.",
      points: [
        "What You Can Do:",
        "Change Display Name: Choose from 6 predefined nicknames to update your opponent's display name.",
        "Change Profile Picture: Select from 4 predefined avatars to change their profile picture.",
        "Duration:",
        "All changes are temporary and will automatically revert back to the original after 24 hours.",
        "Conditions:",
        "If You Win: You gain control over your opponent's profile as described.",
        "If You Lose: Your opponent gains control over your profile with the same options.",
        "If the Game is a Draw: No profile changes are made; both profiles remain unchanged.",
      ],
    },
    {
      title: "Temporary profile lock",
      description: "Win the game to temporarily lock your opponent's profile for 24 hours.",
      points: [
        "What Happens:",
        "Profile Lock: Your opponent cannot change their display name or profile picture.",
        "Duration:",
        "The lock remains in effect for 24 hours after the game ends.",
        "Conditions:",
        "If You Win: Your opponent's profile becomes locked as described.",
        "If You Lose: Your profile becomes locked for 24 hours.",
        "If the Game is a Draw: No profiles are locked; both remain unchanged.",
      ],
    },
    {
      title: "Rating Stakes",
      description: "Win the game to deduct rating points from your opponent.",
      points: [
        "What Happens:",
        "Reduce Opponent's Rating: Deduct the agreed-upon rating points from your opponent's total rating.",
        "Standard Rating Gain: You only receive the standard rating increase for a normal game win.",
        "Duration:",
        "The rating deduction is applied immediately after the game ends and is reflected in the leaderboard rankings.",
        "Conditions:",
        "If You Win: Your opponent's rating decreases by the agreed points, and you gain the standard game rating increase.",
        "If You Lose: Your rating decreases by the agreed points.",
        "If the Game is a Draw: No changes are made to either player's rating; both remain unchanged.",
      ],
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Head>
        <title>Play Chess</title>
        <meta name="description" content="Play chess online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Notification Info Popup */}
      {notificationInfoPopup !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#4C5454',
            borderRadius: 14,
            maxWidth: 340,
            width: '90vw',
            boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Header */}
            <div style={{
              background: '#4A7C59',
              color: '#fff',
              padding: '16px 24px 12px 24px',
              fontWeight: 700,
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setNotificationInfoPopup(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 22,
                  cursor: 'pointer',
                  marginLeft: 12,
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {/* Description */}
            <span className="flex justify-center items-center mt-3 front-roboto text-semibold text-[16px] text-white">{bettingPopups[notificationInfoPopup].title}</span>
            <div style={{
              color: '#ffffff',
              fontWeight: "regular",
              fontSize: 16,
              fontFamily:"roboto",
              padding: '18px 20px 0 20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>{bettingPopups[notificationInfoPopup].description}</div>
            {/* Points */}
            <ul style={{
              color: '#ffffff',
              fontWeight: 400,
              fontSize: 14,
              padding: '12px 28px 24px 32px',
              margin: 0,
              listStyle: 'disc',
            }}>
              {bettingPopups[notificationInfoPopup].points.map((pt, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{pt}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {isMatchmaking ? (
        <WaitingScreen 
          gameType={activeTab.toLowerCase()}
          timeInMinutes={selectedTime}
          onCancel={handleCancelMatchmaking}
        />
      ) : (
        <div className="w-full max-w-[430px] flex flex-col h-screen sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] sm:rounded-xl sm:shadow-lg sm:my-8" style={{ backgroundColor: '#333939' }}>
          {/* Header with back button - 21px padding */}
          <div className="px-[21px] pt-[21px] flex items-center">
            <Link href="/" className="text-[#BFC0C0] hover:text-gray-300 transition-colors">
              <FaArrowLeft size={20} />
            </Link>
            <h1 className="text-[22px] font-semibold mx-auto text-[#FAF3DD] font-poppins tracking-[0.25%]">Match Setup</h1>
          </div>
          
          <div className="flex flex-col flex-1 px-[21px] pt-[21px] pb-[21px]">
            {/* Game mode selection and time buttons in a grid layout */}
            <div className="grid grid-cols-3 gap-x-[16px] mb-[21px]">
              {/* Column 1: Bullet */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Bullet' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Bullet')}
                >
                  <Image 
                    src="/icons/time-modes/bullet.svg" 
                    alt="Bullet" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Bullet</span>
                </div>
                <TimeButton 
                  time={3}
                  isActive={selectedTime === 3}
                  onClick={() => handleTimeSelection(3)}
                />
              </div>
              
              {/* Column 2: Blitz */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Blitz' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Blitz')}
                >
                  <Image 
                    src="/icons/time-modes/blitz.svg" 
                    alt="Blitz" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Blitz</span>
                </div>
                <TimeButton 
                  time={5}
                  isActive={selectedTime === 5}
                  onClick={() => handleTimeSelection(5)}
                />
              </div>
              
              {/* Column 3: Rapid */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Rapid' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Rapid')}
                >
                  <Image 
                    src="/icons/time-modes/rapid.svg" 
                    alt="Rapid" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Rapid</span>
                </div>
                <TimeButton 
                  time={10}
                  isActive={selectedTime === 10}
                  onClick={() => handleTimeSelection(10)}
                />
              </div>
            </div>
            
            {/* Play as selection - 21px bottom margin */}
            <div className="mb-[21px]">
              <div className="rounded-[10px] py-[10px] px-[14px] bg-[#4C5454] flex items-center">
                <p className="text-[#D9D9D9] text-[16px] font-roboto font-normal mr-auto">I play as</p>
                <div className="flex items-center gap-[12px]">
                  <PlayAsButton 
                    type="white"
                    isActive={playAs === 'white'}
                    onClick={() => setPlayAs('white')}
                  />
                  <PlayAsButton 
                    type="random"
                    isActive={playAs === 'random'}
                    onClick={() => setPlayAs('random')}
                  />
                  <PlayAsButton 
                    type="black"
                    isActive={playAs === 'black'}
                    onClick={() => setPlayAs('black')}
                  />
                </div>
              </div>
            </div>
            
            {/* Action buttons - 16px gap between buttons */}
            <div className="mt-auto flex flex-col gap-[16px]">
              <button
                onClick={handleStartMatchmaking}
                className="h-[57px] bg-[#4A7C59] hover:bg-[#3d6549] rounded-[10px] font-semibold transition-colors w-full border-2 border-[#E9CB6B] text-[#FAF3DD] text-[18px] font-poppins"
              >
                Play Random
              </button>
              
              <button
                onClick={() => console.log('Create link')}
                className="h-[57px] bg-[#4C5454] hover:bg-[#3d4343] rounded-[10px] font-semibold transition-colors w-full text-[#FAF3DD] text-[18px] font-poppins"
              >
                Create Link
              </button>
              
              <button
                onClick={() => router.push('/bet/match_setup_screen')}
                className="h-[57px] bg-[#4C5454] hover:bg-[#3d4343] rounded-[10px] font-semibold transition-colors w-full text-[#FAF3DD] text-[18px] font-poppins"
              >
                Create Bet Challenge
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Matchmaking Manager (hidden component) */}
      <MatchmakingManager
        ref={matchmakingRef}
        onGameFound={handleGameFound}
        onError={handleMatchmakingError}
      />
    </div>
  );
};

interface TimeButtonProps {
  time: number;
  isActive: boolean;
  onClick: () => void;
}

const TimeButton: React.FC<TimeButtonProps> = ({
  time,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-[110px] h-[49px] rounded-[10px] transition-colors ${
        isActive ? 'bg-[#4A7C59] hover:bg-[#3d6549]' : 'bg-[#4C5454] hover:bg-[#3d4343]'
      } text-[#FAF3DD] text-[16px] font-semibold font-poppins`}
    >
      {time} min
    </button>
  );
};

interface PlayAsButtonProps {
  type: 'white' | 'black' | 'random';
  isActive: boolean;
  onClick: () => void;
}

const PlayAsButton: React.FC<PlayAsButtonProps> = ({
  type,
  isActive,
  onClick,
}) => {
  // Get the appropriate icon path based on the type
  const getIconPath = () => {
    switch (type) {
      case 'white':
        return '/logos/white_side.svg';
      case 'black':
        return '/logos/black_side.svg';
      case 'random':
        return '/logos/random_side.svg';
      default:
        return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-[36px] h-[36px] flex items-center justify-center ${isActive ? 'bg-[#4A7C59] rounded-[10px]' : ''} transition-colors`}
    >
      <Image 
        src={getIconPath()} 
        alt={`${type} piece`}
        width={22}
        height={22}
        className="w-[22px] h-[22px]"
        priority
      />
    </button>
  );
};

export default PlayPage; 