'use client'
import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import ChessBoard from './ChessBoard';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .square-image, .square-image img {
      border-radius: 0 !important;
      -webkit-border-radius: 0 !important;
      -moz-border-radius: 0 !important;
    }
  `;
  document.head.appendChild(styleEl);
}

interface WaitingScreenProps {
  gameType?: string;
  onCancel: () => void;
  timeInMinutes?: number;
  username?: string;
  rating?: number;
}

// Custom clock component to match the exact Figma design
const CustomClock: React.FC<{ timeInMinutes: number; isTopClock?: boolean }> = ({ timeInMinutes, isTopClock = false }) => {
  const formattedTime = `${timeInMinutes}:00`;
  
  return (
    <div 
      className="flex items-center justify-center font-roboto font-[500] text-[16px] tracking-[.15em] rounded-[4px]"
      style={{
        width: '81px',
        height: '36px',
        backgroundColor: isTopClock ? '#C8D5B9' : '#333939',
        color: isTopClock ? '#1F2323' : '#D9D9D9',
      }}
    >
      {formattedTime}
    </div>
  );
};

// Helper function to get the best available username
const getBestUsername = (displayName?: string, username?: string, defaultName: string = 'Chess Player'): string => {
  // Prioritize custom username over Firebase displayName
  if (username && username.trim() !== '') return username;
  if (displayName && displayName.trim() !== '') return displayName;
  return defaultName;
};

// Helper function to get the best available profile image
const getBestProfileImage = (customPhotoBase64?: string | null, photoURL?: string | null): string => {
  // Prioritize custom photo over Firebase photoURL
  if (customPhotoBase64 && customPhotoBase64.trim() !== '') {
    // Check if it already has the data:image prefix
    if (customPhotoBase64.startsWith('data:image')) {
      return customPhotoBase64;
    }
    return `data:image/jpeg;base64,${customPhotoBase64}`;
  }
  if (photoURL && photoURL.trim() !== '') return photoURL;
  return '/icons/avatar2.svg'; // Default avatar
};
 
const WaitingScreen: React.FC<WaitingScreenProps> = ({
  gameType = 'standard',
  onCancel,
  timeInMinutes = 10,
  // Remove default values for username and rating as we'll get them from auth
}) => {
  // Get the actual time mode from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // We'll use storedGameMode in the UI display
      const storedTimeControl = localStorage.getItem('timeControl');
      
      if (storedTimeControl) {
        // Parse time control string (e.g., "5+0") to get minutes
        const minutes = parseInt(storedTimeControl.split('+')[0], 10);
        if (!isNaN(minutes)) {
          console.log(`Using stored time control: ${minutes} minutes`);
          // No need to set timeInMinutes as it's a prop, but we'll use it in the UI
        }
      }
    }
  }, []);
  const [searchingText, setSearchingText] = useState<string>('Searching...');
  const { socket, isConnected, joinGame, cancelMatchmaking } = useSocket();
  const { user, idToken } = useAuth();
  
  // State for user profile data
  const [userRating, setUserRating] = useState<number>(1500); // Default rating
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userProfileImage, setUserProfileImage] = useState<string>('/icons/avatar2.svg');
  
  // Fetch user profile data when component mounts
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !idToken) {
        console.log('No user or idToken available for profile fetch');
        return;
      }
      
      try {
        console.log('Fetching user profile data...');
        
        // Use the API route to get profile data
        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
        
        console.log('Profile API response status:', response.status);
        
        if (response.ok) {
          const profileData = await response.json();
          console.log('Fetched profile data:', profileData);
          
          // Set user rating if available
          if (profileData.rating) {
            console.log('Setting user rating:', profileData.rating);
            setUserRating(profileData.rating);
          }
          
          // Log the username values we're considering
          console.log('Username options:', {
            customUsername: profileData.username,
            firebaseDisplayName: user.displayName,
          });
          
          // Set user display name using helper function - prioritize custom username
          const bestUsername = getBestUsername(
            user.displayName || undefined,
            profileData.username,
            'Chess Player'
          );
          console.log('Selected best username:', bestUsername);
          setUserDisplayName(bestUsername);
          
          // Log the photo values we're considering
          console.log('Photo options:', {
            customPhotoBase64: profileData.custom_photo_base64 ? 'Present (not showing full base64)' : null,
            firebasePhotoURL: user.photoURL,
            effectivePhotoUrl: profileData.effective_photo_url
          });
          
          // Set profile image using helper function - prioritize custom photo
          // Try multiple possible fields where the custom photo might be stored
          const bestImage = getBestProfileImage(
            profileData.custom_photo_base64 || null,
            profileData.effective_photo_url || profileData.photoURL || user.photoURL
          );
          console.log('Selected best profile image source:', 
            bestImage === '/icons/avatar2.svg' ? 'Default avatar' : 'Custom image');
          setUserProfileImage(bestImage);
        } else {
          console.error('Failed to fetch profile data:', response.status, response.statusText);
          // Fall back to Firebase user data
          if (user) {
            console.log('Falling back to Firebase user data');
            setUserDisplayName(getBestUsername(user.displayName || undefined, undefined, 'Chess Player'));
            setUserProfileImage(user.photoURL || '/icons/avatar2.svg');
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fall back to Firebase user data if available
        if (user) {
          console.log('Falling back to Firebase user data after error');
          setUserDisplayName(getBestUsername(user.displayName || undefined, undefined, 'Chess Player'));
          setUserProfileImage(user.photoURL || '/icons/avatar2.svg');
        }
      }
    };
    
    fetchUserProfile();
  }, [user, idToken]);
 
  // Set up automatic redirection after 5 seconds
  useEffect(() => {
    // Automatically redirect to main chess board after 5 seconds
    const redirectTimer = setTimeout(() => {
      console.log('Auto-redirecting to chess board after 5 seconds');
      onCancel(); // Go back to the chessboard
    }, 5000);
   
    // Clean up the timer when component unmounts
    return () => clearTimeout(redirectTimer);
  }, [onCancel]);
 
  // Join matchmaking when component mounts
  useEffect(() => {
    if (isConnected) {
      joinGame({ gameType });
     
      // Listen for successful match
      socket?.on('gameFound', (gameData) => {
        // Match found notification handling
        console.log('Game found:', gameData);
      });
    }
   
    // Clean up listeners when component unmounts
    return () => {
      socket?.off('gameFound');
    };
  }, [isConnected, joinGame, socket, gameType]);
 
  // Update searching text animation
  useEffect(() => {
    const interval = setInterval(() => {
      // Update searching text with dots animation
      setSearchingText(current => {
        if (current === 'Searching...') return 'Searching';
        return current + '.';
      });
    }, 1000);
   
    return () => clearInterval(interval);
  }, []);
 
  const handleCancel = () => {
    cancelMatchmaking();
    onCancel();
  };
 
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#4A7C59]">
      {/* Top Header - Center-aligned logo with exact 62px height */}
      <div className="w-full bg-[#2B3131] h-[62px] flex items-center justify-center">
        <Image 
          src="/logos/clubmaster-logo.svg"
          alt="ClubMaster Logo"
          width={120}
          height={40}
          className="h-10 w-auto"
          priority
        />
      </div>
      
      {/* Main content container with tighter spacing */}
      <div className="flex flex-col flex-grow justify-between">
        {/* Opponent Info Bar - with minimal spacing from chessboard */}
        <div className="w-full bg-[#4A7C59] py-3 px-4 flex justify-between items-center mb-[12px] mt-[21px]">
          <div className="flex items-start gap-3">
            <div className="w-[48px] h-[48px] flex items-center justify-center">
              <div 
                className="w-[41px] h-[41px] bg-[#4A7C59] relative overflow-hidden rounded-[4px]"
              >
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Image 
                    src="/icons/avatar1.svg"
                    alt="Player Avatar"
                    width={41}
                    height={41}
                    className="w-full h-full"
                    style={{ objectFit: 'contain' }}
                    unoptimized={true}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[#FAF3DD] font-roboto font-[500] text-[16px] tracking-[0.25%]">{searchingText}</span>
              {/* Empty space for captured pieces to maintain consistent layout */}
              <div className="mt-[4px]"></div>
            </div>
          </div>
          {/* Custom top clock with specified styling */}
          <CustomClock 
            timeInMinutes={(() => {
              // Try to get time from localStorage first
              if (typeof window !== 'undefined') {
                const storedTimeControl = localStorage.getItem('timeControl');
                if (storedTimeControl) {
                  const minutes = parseInt(storedTimeControl.split('+')[0], 10);
                  if (!isNaN(minutes)) {
                    return minutes;
                  }
                }
              }
              // Fall back to prop if localStorage not available
              return timeInMinutes;
            })()} 
            isTopClock={true} 
          />
        </div>
        
        {/* Main Content with Blurred Chessboard and Modal - Tightly nested between player info rows */}
        <div className="flex-grow relative flex items-center justify-center overflow-hidden p-0 m-0">
          {/* Chessboard with dividers as frame - positioned as a single unit */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[430px] flex flex-col m-0 p-0">
              {/* Top border of chessboard frame - NO blur */}
              <div className="w-full h-[13px] bg-[#333939] m-0 p-0"></div>
              
              {/* Chessboard itself - ONLY this element has blur */}
              <div className="w-full h-[430px] relative overflow-hidden m-0 p-0">
                <div className="absolute inset-0 backdrop-blur-3xl filter blur-[12px]">
                  <ChessBoard perspective="white" />
                </div>
              </div>
              
              {/* Bottom border of chessboard frame - NO blur */}
              <div className="w-full h-[13px] bg-[#333939] m-0 p-0"></div>
            </div>
          </div>
          
          {/* Starting Soon Modal - Exact dimensions and styling with 10px border radius */}
          <div className="relative z-[20] w-[238px] h-[197px] bg-[#333939] rounded-[10px] flex flex-col items-center justify-center">
            <div className="text-[#FAF3DD] font-roboto font-medium text-[16px] tracking-[0.25%] mb-6">
    {(() => {
      // Try to get time from localStorage first
      if (typeof window !== 'undefined') {
        const storedTimeControl = localStorage.getItem('timeControl');
        const storedGameMode = localStorage.getItem('gameMode');
        
        if (storedTimeControl) {
          const minutes = parseInt(storedTimeControl.split('+')[0], 10);
          if (!isNaN(minutes)) {
            return `${minutes} min ${storedGameMode || ''}`;
          }
        }
      }
      // Fall back to prop if localStorage not available
      return `${timeInMinutes} min game`;
    })()}
  </div>
            <div className="mb-6">
              <Image 
                src="/icons/waiting-clock.svg"
                alt="Clock"
                width={40}
                height={40}
                className="text-[#4A7C59]"
              />
            </div>
            <div className="text-[#FAF3DD] font-roboto font-medium text-[17px]">Starting soon..</div>
          </div>
        </div>
        
        {/* Player Info Bar - with minimal spacing from chessboard */}
        <div className="w-full bg-[#4A7C59] py-3 px-4 flex justify-between items-center mt-[12px] mb-[21px]">
          <div className="flex items-start gap-3">
            <div className="w-[48px] h-[48px] flex items-center justify-center">
              <div 
                className="w-[48px] h-[48px] bg-[#4A7C59] relative overflow-hidden rounded-[4px]"
              >
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Image 
                    src={userProfileImage}
                    alt="Player Avatar"
                    width={48}
                    height={48}
                    className="w-full h-full"
                    style={{ objectFit: 'contain' }}
                    unoptimized={true}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[#FAF3DD] font-roboto font-[500] text-[16px] tracking-[0.25%]">
                {userDisplayName} ({userRating})
              </span>
              {/* Empty space for captured pieces to maintain consistent layout */}
              <div className="mt-[4px]"></div>
            </div>
          </div>
          {/* Custom bottom clock with specified styling */}
          <CustomClock 
            timeInMinutes={(() => {
              // Try to get time from localStorage first
              if (typeof window !== 'undefined') {
                const storedTimeControl = localStorage.getItem('timeControl');
                if (storedTimeControl) {
                  const minutes = parseInt(storedTimeControl.split('+')[0], 10);
                  if (!isNaN(minutes)) {
                    return minutes;
                  }
                }
              }
              // Fall back to prop if localStorage not available
              return timeInMinutes;
            })()} 
            isTopClock={false} 
          />
        </div>
      </div>
      
      {/* Cancel Button - with 21px bottom margin */}
      <div className="w-full flex justify-center px-4 mb-[21px]">
        <button
          id="cancel-matchmaking-button"
          onClick={handleCancel}
          className="w-[388px] h-[57px] bg-[#333939] hover:bg-[#4A4A4A] text-[#FAF3DD] font-roboto font-medium text-[18px] tracking-[0.25%] rounded-[10px] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
 
export default WaitingScreen;