"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import * as betService from "@/services/betService";
import * as socketService from "@/services/socketService";
import { BetType } from "@/types/bet";
import { useBet } from '@/context/BetContext';
import { useSocket } from '@/context/SocketContext';
import { ProfileDataService } from '@/utils/ProfileDataService';
import { useToast } from '@/hooks/useToast';
import { bettingPopups } from "@/data/bettingPopups";

// Color codes
const TITLE_COLOR = "#FAF3DD";
const ACTIVE_COLOR = "#8FC0A9";
const BG_COLOR = "#363B3B";
const CARD_COLOR = "#4C5454";
const BUTTON_DISABLED = "#2B3A31";
const BUTTON_TEXT_DISABLED = "#7A8B7A";
const BUTTON_TEXT_ENABLED = "#FAF3DD";
const LABEL_COLOR = "#FAF3DD";


const timerOptions = ["3 min", "5 min", "10 min"];

const playAsOptions = [
  { label: "White", value: "white", icon: (
    <Image src="/images/white_side.png" alt="White King" width={40} height={40} style={{ borderRadius: 10 }} />
  ) },
  { label: "Random", value: "random", icon: (
    <Image src="/images/random_side.png" alt="Random" width={40} height={40} style={{ borderRadius: 10 }} />
  ) },
  { label: "Black", value: "black", icon: (
    <Image src="/images/black_side.png" alt="Black King" width={40} height={40} style={{ borderRadius: 10 }} />
  ) },
];

const bettingOptions = [
  { label: "Temporary Profile Control", value: "control" },
  { label: "Temporary Profile Lock", value: "lock" },
  { label: "Rating Stake", value: "stake" },
];

const ratingStakeOptions = [20, 40, 60, 80];

// Timer button colors
const TIMER_ACTIVE = "#4A7C59";
const TIMER_INACTIVE = "#4C5454";

export default function MatchSetupScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const friend = searchParams.get("opponent");
  const opponentId = searchParams.get("opponentId");
  const opponentSocketId = searchParams.get("socketId");

  // Timer type and time selection
  const [selectedTimerType, setSelectedTimerType] = useState(2); // 0: Bullet, 1: Blitz, 2: Rapid
  const [selectedTimer, setSelectedTimer] = useState(2); // 0: 3min, 1: 5min, 2: 10min
  const [selectedPlayAs, setSelectedPlayAs] = useState(1); // default random
  const [selectedBetting, setSelectedBetting] = useState<number | null>(null);
  const [selectedStake, setSelectedStake] = useState(ratingStakeOptions[0]);

  // Add useState for custom dropdown open/close
  const [stakeDropdownOpen, setStakeDropdownOpen] = useState(false);

  // Add useState for betting info popup
  const [openPopup, setOpenPopup] = useState<null | 0 | 1 | 2>(null);

  // Add after other useState hooks
  const [waitingPopupOpen, setWaitingPopupOpen] = useState(false);
  
  // Track the pending bet ID for cancellation
  const [pendingBetId, setPendingBetId] = useState<string | null>(null);
  const [betError, setBetError] = useState<string | null>(null);

  // Add a state for opponent photo URL
  const [opponentPhotoURL, setOpponentPhotoURL] = useState<string | null>(null);

  // Add a state to track rejection reason
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  // Only show timer options relevant to timer type
  const timerTypeToOption = { 0: 0, 1: 1, 2: 2 } as const;
  React.useEffect(() => {
    setSelectedTimer(timerTypeToOption[selectedTimerType as keyof typeof timerTypeToOption]);
  }, [selectedTimerType]);

  // Use BetContext
  const { sendBetChallenge } = useBet();
  const { isConnected } = useSocket();

  // Create a ProfileDataService instance at the component level
  const profileDataService = new ProfileDataService();

  // Add toast at the component level, not inside useEffect
  const toast = useToast();

  // Update the useEffect to correctly fetch opponent profile data using the new method
  useEffect(() => {
    if (opponentId) {
      // Fetch opponent details to get their photoURL
      const fetchOpponentDetails = async () => {
        try {
          console.log(`Fetching opponent profile data for ID: ${opponentId}`);
          // Use the dedicated method for fetching other users' profiles
          const profileData = await profileDataService.fetchOtherUserProfile(opponentId);
          
          if (profileData) {
            console.log('Opponent profile data fetched:', {
              id: profileData.id,
              displayName: profileData.displayName,
              photoURL: profileData.photoURL,
              effective_photo_url: profileData.effective_photo_url
            });
            
            // Use effective_photo_url first (which may include custom_photo_base64), 
            // then fall back to photoURL
            setOpponentPhotoURL(profileData.effective_photo_url || profileData.photoURL || null);
          } else {
            console.log('No profile data found for opponent');
            setOpponentPhotoURL(null);
          }
        } catch (error) {
          console.error("Failed to fetch opponent details:", error);
          setOpponentPhotoURL(null);
        }
      };

      fetchOpponentDetails();
    }
  }, [opponentId]);

  // Update the socket event listeners
  useEffect(() => {
    // Initialize socket connection
    const socket = socketService.getSocket();
    
    // Listen for bet challenge responses
    betService.onBetChallengeResponse((response) => {
      console.log('Bet challenge response received:', response);
      
      // Fix: Always check if we're waiting for any bet response, not just for a specific betId
      // This ensures we handle rejections even if the betId doesn't match exactly
      if (waitingPopupOpen) {
        // If we have a specific pending bet ID, check if it matches
        if (pendingBetId && response.betId !== pendingBetId) {
          console.log(`Ignoring response for different bet ID. Expected: ${pendingBetId}, Got: ${response.betId}`);
          return;
        }
        
        if (response.accepted) {
          // If challenge was accepted, close the waiting screen
          // The matchFound event will handle navigation to the game
          setWaitingPopupOpen(false);
          console.log('Bet challenge accepted, waiting for matchmaking to complete...');
          
          // Clear any rejection message
          setRejectionMessage(null);
          
          // Add a message to inform the user
          toast.success("Challenge accepted! Setting up the game...");
        } else {
          // If challenge was rejected, close the waiting screen
          setWaitingPopupOpen(false);
          
          // Clear the pending bet ID since it's no longer active
          setPendingBetId(null);
          
          // Create a more informative rejection message
          const opponentName = friend || 'Your opponent';
          const rejectMessage = `${opponentName} declined your challenge`;
          
          // Set the rejection message for display in the UI
          setRejectionMessage(rejectMessage);
          
          // Show toast notification
          toast.error(rejectMessage);
          
          console.log('Bet challenge rejected by opponent');
        }
      }
    });
    
    // Listen for bet game ready event
    betService.onBetGameReady((data) => {
      console.log('Bet game ready event received:', data);
      if (data && data.gameId) {
        // Navigate to the game page
        console.log(`Navigating to game: /play/game/${data.gameId}`);
        
        // Close the waiting popup if it's still open
        setWaitingPopupOpen(false);
        
        // Clear any rejection message
        setRejectionMessage(null);
        
        // Show a success toast
        toast.success("Game ready! Redirecting to the game...");
        
        // Navigate to the game page
        router.push(`/play/game/${data.gameId}`);
      }
    });

    // Add a listener for bet challenge expiration
    betService.onBetChallengeExpired((data) => {
      console.log('Bet challenge expired:', data);
      
      // Check if the expired challenge is the one we're waiting for
      if (data.betId === pendingBetId) {
        // Close the waiting popup
        setWaitingPopupOpen(false);
        
        // Clear the pending bet ID
        setPendingBetId(null);
        
        // Clear any rejection message and set an expiration message
        setRejectionMessage("Your bet challenge has expired. The opponent didn't respond in time.");
        
        // Show a toast notification
        toast.warning("Bet challenge expired. Your opponent didn't respond in time.");
      }
    });

    // Listen for bet challenge cancellation (in case the server cancels it)
    betService.onBetChallengeCancelled((data) => {
      console.log('Bet challenge cancelled:', data);
      
      // Check if the cancelled challenge is the one we're waiting for
      if (data.betId === pendingBetId) {
        // Close the waiting popup
        setWaitingPopupOpen(false);
        
        // Clear the pending bet ID
        setPendingBetId(null);
        
        // Clear any rejection message and set a cancellation message
        setRejectionMessage("Your bet challenge was cancelled.");
        
        // Show a toast notification
        toast.warning("Bet challenge cancelled.");
      }
    });

    // Listen for socket reconnect events
    socket.on('connect', () => {
      console.log('Socket reconnected, checking authentication status...');
      // If we were waiting for a bet response, we may need to refresh the state
      if (waitingPopupOpen && pendingBetId) {
        // Check the status of the pending bet
        betService.checkBetChallengeStatus(pendingBetId)
          .then((status) => {
            console.log('Retrieved bet challenge status:', status);
            if (status && status.status !== 'pending') {
              // If the bet is no longer pending, update the UI
              setWaitingPopupOpen(false);
              
              // If it was accepted and we have a game ID, navigate to the game
              if (status.status === 'accepted' && status.gameId) {
                console.log(`Navigating to game: /play/game/${status.gameId}`);
                router.push(`/play/game/${status.gameId}`);
              }
            }
          })
          .catch((err: Error) => {
            console.error('Error checking bet challenge status:', err);
            // Keep the waiting popup open, but show an error
            toast.warning("Unable to check challenge status. Please wait or try again.");
          });
      }
    });

    // Listen for bet challenge error
    socket.on('bet_challenge_failed', (error) => {
      console.error('Error creating bet challenge:', error);
      setWaitingPopupOpen(false);
      toast.error(error.message || "An error occurred while creating the bet challenge.");
    });

    // Clean up listeners when component unmounts
    return () => {
      betService.offBetChallengeResponse();
      betService.offBetGameReady();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      socket.off('connect');
      socket.off('bet_challenge_failed');
    };
  }, [pendingBetId, waitingPopupOpen, router, toast, friend]);

  // Add a retry function
  const handleRetryBetChallenge = () => {
    // Clear error message
    setBetError(null);
    // Try sending the request again
    handleSendRequest();
  };

  // Update the onClick handler for the "Send Request" button
  const handleSendRequest = async () => {
    // Prevent sending if not authenticated
    if (!isConnected) {
      setBetError("Socket not authenticated. Please wait for connection.");
      return;
    }
    
    // Clear any previous error or rejection message
    setBetError(null);
    setRejectionMessage(null);
    
    // Add more debug logging
    console.log("Send Request clicked with state:", {
      selectedBetting,
      isConnected,
      opponentId,
      opponentSocketId
    });
    
    // Determine bet type and parameters
    let betType: BetType;
    let stakeAmount: number | undefined;

    // Force re-read selectedBetting from state to ensure we have the latest value
    const currentSelectedBetting = selectedBetting;
    console.log("Current selected betting option:", currentSelectedBetting);

    if (currentSelectedBetting === null) {
      console.error("No betting option selected");
      setBetError("Please select a betting option");
      return;
    }

    switch (currentSelectedBetting) {
        case 0: // Profile Control
            betType = BetType.PROFILE_CONTROL;
            break;
        case 1: // Temporary Profile Lock
            betType = BetType.PROFILE_LOCK;
            break;
        case 2: // Rating Stake
            betType = BetType.RATING_STAKE;
            stakeAmount = selectedStake;
            break;
        default:
            console.error("Invalid betting option selected:", currentSelectedBetting);
            setBetError("Invalid betting option selected");
            return;
    }
    
    const options = {
      opponentId: opponentId || undefined,
      opponentSocketId: opponentSocketId || undefined,
      betType,
      stakeAmount,
      gameMode: selectedTimerType === 0 ? 'Bullet' : selectedTimerType === 1 ? 'Blitz' : 'Rapid',
      timeControl: selectedTimer === 0 ? '3+0' : selectedTimer === 1 ? '5+0' : '10+0',
      preferredSide: selectedPlayAs === 0 ? 'white' : selectedPlayAs === 1 ? 'random' : 'black',
    };
    
    console.log("Sending bet challenge with options:", options);

    // Show the waiting popup immediately
    setWaitingPopupOpen(true);

    try {
      // Send the bet challenge request with the Promise-based API
      const result = await sendBetChallenge(options);

      // Check the result
      if (result.success) {
        console.log("Bet challenge created:", result);
        // Store the bet ID for cancellation
        if (result.betId) {
          setPendingBetId(result.betId);
        }
        // We no longer auto-close the waiting popup after success
        // The user must manually cancel or the opponent must respond
      } else {
        console.log("Error creating bet challenge:", result.message);
        setBetError(result.message || "Failed to create bet challenge");
        // Close the waiting popup if there was an error
        setWaitingPopupOpen(false);
      }
    } catch (error) {
      console.error("Exception sending bet challenge:", error);
      setBetError("An unexpected error occurred. Please try again.");
      // Close the waiting popup if there was an error
      setWaitingPopupOpen(false);
    }
  };

  // Add debug logging when component mounts
  useEffect(() => {
    console.log('Match setup screen initialized with params:', {
      friend,
      opponentId,
      opponentSocketId
    });
  }, []);

  // Add debug logging to track state changes
  useEffect(() => {
    console.log('Selected betting option changed:', selectedBetting);
  }, [selectedBetting]);
  
  // Add a useEffect to ensure the bet type selection is properly initialized
  useEffect(() => {
    // Store the selected betting option in localStorage to persist across re-renders
    if (selectedBetting !== null) {
      localStorage.setItem('selectedBettingOption', selectedBetting.toString());
    } else {
      localStorage.removeItem('selectedBettingOption');
    }
  }, [selectedBetting]);
  
  // Initialize the selected betting option from localStorage on component mount
  useEffect(() => {
    const savedBettingOption = localStorage.getItem('selectedBettingOption');
    if (savedBettingOption !== null) {
      const option = parseInt(savedBettingOption, 10);
      if (!isNaN(option) && option >= 0 && option <= 2) {
        console.log('Initializing selected betting option from localStorage:', option);
        setSelectedBetting(option);
      }
    }
  }, []);

  // Add a useEffect to log state changes for selectedBetting
  useEffect(() => {
    console.log('selectedBetting state changed:', selectedBetting);
    
    // Store in localStorage for persistence
    if (selectedBetting !== null) {
      localStorage.setItem('selectedBettingOption', selectedBetting.toString());
    } else {
      localStorage.removeItem('selectedBettingOption');
    }
  }, [selectedBetting]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start" style={{ background: BG_COLOR }}>
      {/* Popup Overlay */}
      {openPopup !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
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
                onClick={() => setOpenPopup(null)}
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
            <span className="flex justify-center items-center mt-3 front-roboto text-semibold text-[16px] text-white">{bettingPopups[openPopup].title}</span>
            <div style={{
              color: '#ffffff',
              fontWeight: "regular",
              fontSize: 16,
              fontFamily:"roboto",
              padding: '18px 20px 0 20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>{bettingPopups[openPopup].description}</div>
            {/* Points */}
            <ul style={{
              color: '#ffffff',
              fontWeight: 400,
              fontSize: 14,
              padding: '12px 28px 24px 32px',
              margin: 0,
              listStyle: 'disc',
            }}>
              {bettingPopups[openPopup].points.map((pt, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{pt}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Show rejection message when there's a bet rejection */}
      {rejectionMessage && (
        <div className="fixed top-16 left-0 right-0 mx-auto w-4/5 max-w-md bg-red-500 text-white p-3 rounded-md text-center z-50">
          <p>{rejectionMessage}</p>
        </div>
      )}
      {/* Show error message when there's a bet error */}
      {betError && (
        <div className="fixed bottom-16 left-0 right-0 mx-auto w-4/5 max-w-md bg-red-500 text-white p-3 rounded-md text-center z-50 flex flex-col items-center">
          <p>{betError}</p>
          {betError.includes("Failed") || betError.includes("Error") ? (
            <button 
              className="mt-2 bg-white text-red-500 px-4 py-1 rounded-md font-medium text-sm"
              onClick={handleRetryBetChallenge}
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
      {/* Waiting Popup Overlay */}
      {waitingPopupOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <div style={{
            background: '#4C5454',
            borderRadius: 18,
            maxWidth: 320,
            width: '90vw',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 20px 20px 20px',
          }}>
            <Image
              src={opponentPhotoURL || "/images/profile_waiting_screen.png"}
              alt="Opponent Avatar"
              width={64}
              height={64}
              style={{ borderRadius: '50%', marginBottom: 18, border: '4px solid #fff', background: '#fff' }}
              onError={(e) => {
                // If the opponent's profile image fails to load, fall back to the default image
                (e.target as HTMLImageElement).src = "/images/profile_waiting_screen.png";
              }}
            />
            <div style={{ color: '#D9D9D9', fontWeight: "medium", fontSize: 16, marginBottom: 4, textAlign: 'center',fontFamily: "roboto"  }}>
              {timerOptions[selectedTimer]} game
            </div>
            <div style={{ color: '#D9D9D9', fontWeight: "regular", fontSize: 16, marginBottom: 0, textAlign: 'center', fontFamily: "roboto" }}>
              Waiting for {friend ? friend : 'opponent'}...
            </div>
          </div>
          {/* Cancel button wrapper, same as send-request-btn-wrapper */}
          <div className="send-request-btn-wrapper mb-4" style={{ marginTop: 64, background: 'transparent' ,display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <button
              className="w-full py-4  font-semibold text-lg send-request-btn "
              style={{
                background: '#4C5454',
                color: '#FAF3DD',
                borderRadius: 10,
                cursor: 'pointer',
                maxWidth:"410px",
                transition: 'all 0.2s',
              }}
              onClick={() => {
                // Cancel bet challenge if there is one
                if (pendingBetId) {
                  console.log("Cancelling bet challenge:", pendingBetId);
                  betService.cancelBetChallenge(pendingBetId);
                }
                // Close waiting popup
                setWaitingPopupOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-20 w-full" style={{ background: BG_COLOR }}>
        <div className="flex items-center px-2 py-4  mx-auto">
          <Link href="/bet" className="mr-2">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" stroke="#FAF3DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-xl font-semibold" style={{ color: TITLE_COLOR, letterSpacing: 1 }}>Match Setup</h1>
          <span className="w-8" />
        </div>
      </div>
      {/* Main Card */}
      <div className="w-full flex flex-col items-center flex-1" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="w-full max-w-[400px] px-3 sm:px-0 flex flex-col gap-5 mt-4 mb-0">
          {/* Timer Type and Time Selection - Redesigned */}
          <div className="grid grid-cols-3 gap-x-4 ">
            {/* Column 1: Bullet */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`flex items-center gap-1 cursor-pointer ${selectedTimerType === 0 ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                onClick={() => { setSelectedTimerType(0); setSelectedTimer(0); }}
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
              <button
                className="flex-1 py-2 rounded-[10px] font-semibold"
                style={{
                  background: selectedTimer === 0 ? TIMER_ACTIVE : TIMER_INACTIVE,
                  color: '#FAF3DD',
                  border: 'none',
                  height: "49px",
                  width: "110px",
                  fontSize: 18,
                  transition: "all 0.2s",
                }}
                onClick={() => { setSelectedTimerType(0); setSelectedTimer(0); }}
              >
                3 min
              </button>
            </div>
            {/* Column 2: Blitz */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`flex items-center gap-1 cursor-pointer ${selectedTimerType === 1 ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                onClick={() => { setSelectedTimerType(1); setSelectedTimer(1); }}
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
              <button
                className="flex-1 py-2 rounded-[10px] font-semibold"
                style={{
                  background: selectedTimer === 1 ? TIMER_ACTIVE : TIMER_INACTIVE,
                  color: '#FAF3DD',
                  border: 'none',
                  height: "49px",
                  width: "110px",
                  fontSize: 18,
                  transition: "all 0.2s",
                }}
                onClick={() => { setSelectedTimerType(1); setSelectedTimer(1); }}
              >
                5 min
              </button>
            </div>
            {/* Column 3: Rapid */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`flex items-center gap-1 cursor-pointer ${selectedTimerType === 2 ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                onClick={() => { setSelectedTimerType(2); setSelectedTimer(2); }}
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
              <button
                className="flex-1 py-2 rounded-[10px] font-semibold"
                style={{
                  background: selectedTimer === 2 ? TIMER_ACTIVE : TIMER_INACTIVE,
                  color: '#FAF3DD',
                  border: 'none',
                  height: "49px",
                  width: "110px",
                  fontSize: 18,
                  transition: "all 0.2s",
                }}
                onClick={() => { setSelectedTimerType(2); setSelectedTimer(2); }}
              >
                10 min
              </button>
            </div>
          </div>
          {/* Select Opponent Card */}
          <div className="rounded-[10px]  flex items-center px-3 py-3" style={{ background: CARD_COLOR }}>
            <Image
              src={opponentPhotoURL || "/images/atm_profile_avatar-icon.png"}
              alt="friend avatar"
              width={32}
              height={32}
              className="rounded-full"
              onError={(e) => {
                // Fallback to default image if the photo fails to load
                (e.target as HTMLImageElement).src = "/images/atm_profile_avatar-icon.png";
              }}
            />
            <span className="ml-3 flex-1 text-[#FAF3DD] font-medium" style={{ fontSize: 16 }}>{friend ? friend : "Select opponent"}</span>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {/* I play as Card */}
          <div className="rounded-[10px]  m flex items-center px-3 py-3" style={{ background: CARD_COLOR }}>
            <span className="flex-1 text-[#B0B0B0]" style={{ fontSize: 16 }}>I play as</span>
            <div className="flex" style={{ gap: 12 }}>
              {playAsOptions.map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedPlayAs(idx)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: selectedPlayAs === idx ? '3px solid #4A7C59' : '5px solid transparent',
                    background: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'border 0.2s',
                  }}
                  aria-label={opt.label}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>
          {/* Betting Options */}
          <div>
            <div className="mb-4" style={{ color: LABEL_COLOR, fontWeight: 600, fontSize: 15 }}>Choose Betting Option</div>
            <div className="flex flex-col gap-3">
              {bettingOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  className="flex items-center rounded-xl px-3 py-3 cursor-pointer"
                  style={{ background: CARD_COLOR }}
                  onClick={() => {
                    console.log('Betting option card clicked:', idx);
                    // Use the functional form of setState to ensure we're working with the latest state
                    setSelectedBetting(prevState => {
                      const newState = prevState === idx ? null : idx;
                      console.log(`Setting selectedBetting from ${prevState} to ${newState}`);
                      return newState;
                    });
                  }}
                >
                  <span 
                    className="flex-1 text-[#FAF3DD] font-medium cursor-pointer" 
                    style={{ fontSize: 15 }}
                  >
                    {opt.label}
                  </span>
                  <span className="mx-2">
                    <button
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width:28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#4A7C59 ",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 18,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Stop event propagation
                        setOpenPopup(idx as 0 | 1 | 2);
                      }}
                      aria-label={`Show info for ${opt.label}`}
                    >
                      ?
                    </button>
                  </span>
                  {opt.value === "stake" && selectedBetting === idx ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#D6E7C2',
                      borderRadius: 8,
                      height: 32,
                      minWidth: 70,
                      fontWeight: 700,
                      fontSize: 18,
                      color: '#222',
                      overflow: 'visible',
                      marginLeft: 8,
                      boxSizing: 'border-box',
                      border: 'none',
                      position: 'relative',
                      cursor: selectedBetting === idx ? 'pointer' : 'not-allowed',
                    }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: 40,
                          height: 32,
                          paddingLeft: 8,
                          fontWeight: 700,
                          fontSize: 18,
                          color: '#222',
                          userSelect: 'none',
                        }}
                        onClick={() => setStakeDropdownOpen(open => !open)}
                      >
                        {selectedStake}
                      </div>
                      <div style={{
                        width: 1,
                        height: 22,
                        background: '#B0B0B0',
                        margin: '0 6px',
                        zIndex: 1,
                      }} />
                      <div
                        style={{ width: 24, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onClick={() => setStakeDropdownOpen(open => !open)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      {stakeDropdownOpen && (
                        <div style={{
                          position: 'absolute',
                          top: 36,
                          left: 0,
                          minWidth: 70,
                          background: '#D6E7C2',
                          borderRadius: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                          zIndex: 10,
                          overflow: 'hidden',
                        }}>
                          {ratingStakeOptions.map((amt) => (
                            <div
                              key={amt}
                              style={{
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 18,
                                color: selectedStake === amt ? '#fff' : '#222',
                                background: selectedStake === amt ? '#4A7C59' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#4A7C59'}
                              onMouseLeave={e => e.currentTarget.style.background = selectedStake === amt ? '#4A7C59' : 'transparent'}
                              onClick={() => { setSelectedStake(amt); setStakeDropdownOpen(false); }}
                            >
                              {amt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <button
                    className="ml-3"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      console.log('Betting checkbox clicked:', idx, 'Current state:', selectedBetting);
                      // Use the functional form of setState to ensure we're working with the latest state
                      setSelectedBetting(prevState => {
                        const newState = prevState === idx ? null : idx;
                        console.log(`Setting selectedBetting from ${prevState} to ${newState}`);
                        return newState;
                      });
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: selectedBetting === idx ? ACTIVE_COLOR : "#B0B0B0",
                      background: selectedBetting === idx ? ACTIVE_COLOR : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                    aria-label={`Select ${opt.label}`}
                  >
                    {selectedBetting === idx && (
                      <span style={{ color: "#FAF3DD", fontSize: 16 }}>✓</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {/* Add vertical space between betting options and button on large screens only */}
          <div className="betting-btn-gap" />
          {/* Send Request Button: inside card for desktop, fixed for mobile */}
          <div className="send-request-btn-wrapper mb-4">
            <button
              className="w-full py-3 font-semibold text-lg send-request-btn"
              style={{
                background: selectedBetting !== null && isConnected ? "#4A7C59" : BUTTON_DISABLED,
                color: selectedBetting !== null && isConnected ? BUTTON_TEXT_ENABLED : BUTTON_TEXT_DISABLED,
                borderColor: selectedBetting !== null && isConnected ? "#E9CB6B" : "#3A4A3A",
                borderWidth: 2,
                borderStyle: 'solid',
                borderRadius: 10,
                cursor: selectedBetting !== null && isConnected ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
              disabled={selectedBetting === null || !isConnected}
              onClick={() => {
                console.log('Send Request clicked with selectedBetting:', selectedBetting);
                // Only proceed if selectedBetting is not null
                if (selectedBetting !== null && isConnected) {
                  handleSendRequest();
                } else {
                  console.log('Send Request button clicked but disabled. selectedBetting:', selectedBetting, 'isConnected:', isConnected);
                }
              }}
            >
              Send Request
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media (max-width: 600px) {
          .text-xl { font-size: 1.2rem; }
          .text-base { font-size: 1rem; }
          .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
          .max-w-\[400px\] { max-width: 100vw !important; }
          .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .send-request-btn-wrapper {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            background: #363B3B;
            padding: 12px 12px 24px 12px;
            z-index: 50;
            
          }
          .send-request-btn {
            border-radius: 12px !important;
            margin: 0 !important;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
            display: block;
          }
        }
        @media (min-width: 601px) {
          .max-w-\[400px\] { max-width: 400px !important; }
          .px-2 { padding-left: 1rem; padding-right: 1rem; }
          .send-request-btn-wrapper {
            position: static;
            background: none;
            box-shadow: none;
            padding: 0;
            margin-top: 0;
            width: 100%;
            max-width: none;
            margin-left: 0;
            margin-right: 0;
            display: block;
          }
          .send-request-btn {
            border-radius: 12px !important;
            margin: 0 !important;
            width: 100%;
            max-width: 100%;
            display: block;
          }
          .betting-btn-gap {
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
}