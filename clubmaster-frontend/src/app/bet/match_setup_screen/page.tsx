"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import BetChallengeNotification from "../../components/BetChallengeNotification";
import * as betService from "@/services/betService";
import * as socketService from "@/services/socketService";
import { BetType } from "@/types/bet";
import { useBet } from '@/context/BetContext';

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

// Add popup content data
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
    title: "Rating Stakes",
    description: "Win the game to gain temporary control over your opponent's profile for 24 hours.",
    points: [
      "What Happens:",
      "Reduce Opponent's Rating: Deduct the agreed-upon rating points from your opponent's total rating (default: 200 points, customizable).",
      "Standard Rating Gain: You only receive the standard rating increase for a normal game win.",
      "Duration:",
      "The rating deduction is applied immediately after the game ends and is reflected in the leaderboard rankings.",
      "Conditions:",
      "If You Win: Your opponent's rating decreases by the agreed points, and you gain the standard game rating increase.",
      "If You Lose: Your rating decreases by the agreed points..",
      "If the Game is a Draw: No changes are made to either player's rating; both remain unchanged.",
    ],
  },
];

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
  
  // Add notification state
  const [showBetNotification, setShowBetNotification] = useState(false);

  // Add after other useState hooks
  const [notificationInfoPopup, setNotificationInfoPopup] = useState<null | 0 | 1 | 2>(null);
  
  // Add state for bet challenge
  const [pendingBetId, setPendingBetId] = useState<string | null>(null);

  // Only show timer options relevant to timer type
  const timerTypeToOption = { 0: 0, 1: 1, 2: 2 } as const;
  React.useEffect(() => {
    setSelectedTimer(timerTypeToOption[selectedTimerType as keyof typeof timerTypeToOption]);
  }, [selectedTimerType]);

  // Use BetContext
  const { sendBetChallenge } = useBet();

  // Set up socket event listeners
  useEffect(() => {
    // Initialize socket connection
    const socket = socketService.getSocket();
    
    // Listen for bet challenge responses
    betService.onBetChallengeResponse((response) => {
      console.log('Bet challenge response received:', response);
      
      if (response.betId === pendingBetId) {
        if (response.accepted) {
          // If challenge was accepted, navigate to waiting screen
          // The actual game start will be handled by the matchFound event in MatchmakingManager
          setWaitingPopupOpen(false);
          router.push('/play');
        } else {
          // If challenge was rejected, show error toast and close waiting screen
          setWaitingPopupOpen(false);
          // TODO: Add toast notification for rejection
          console.log('Bet challenge rejected');
        }
      }
    });
    
    // Listen for bet challenge expiration
    betService.onBetChallengeExpired((data) => {
      console.log('Bet challenge expired:', data);
      
      if (data.betId === pendingBetId) {
        setWaitingPopupOpen(false);
        // TODO: Add toast notification for expiration
        console.log('Bet challenge expired');
      }
    });
    
    // Listen for bet challenge cancellation
    betService.onBetChallengeCancelled((data) => {
      console.log('Bet challenge cancelled:', data);
      
      // This would be received by the opponent
      setShowBetNotification(false);
      // TODO: Add toast notification for cancellation
      console.log('Bet challenge cancelled by opponent');
    });
    
    // Listen for bet challenge creation response
    socket.on('bet_challenge_created', (data) => {
      console.log('Bet challenge created:', data);
      
      if (data.data && data.data.success) {
        // Store the bet ID for later reference
        setPendingBetId(data.data.betId);
      } else {
        // If creation failed, show error and close waiting screen
        setWaitingPopupOpen(false);
        // TODO: Add toast notification for error
        console.log('Error creating bet challenge');
      }
    });
    
    // Listen for bet challenge error
    socket.on('bet_challenge_error', (data) => {
      console.log('Bet challenge error:', data);
      
      // Show error and close waiting screen
      setWaitingPopupOpen(false);
      // TODO: Add toast notification for error
      console.log('Error with bet challenge:', data.data?.message);
    });
    
    // Listen for incoming bet challenges (should not happen in this screen but for completeness)
    betService.onBetChallengeReceived((challenge) => {
      console.log('Bet challenge received:', challenge);
      // We'll handle this in the main play screen
    });
    
    // Clean up listeners on unmount
    return () => {
      betService.offBetChallengeResponse();
      betService.offBetChallengeExpired();
      betService.offBetChallengeCancelled();
      betService.offBetChallengeReceived();
      socket.off('bet_challenge_created');
      socket.off('bet_challenge_error');
    };
  }, [pendingBetId, router]);

  // Add effect to show mock notification in waiting screen for demo purposes
  // Note: In a real implementation, this would be triggered by socket events
  useEffect(() => {
    let notificationTimer: NodeJS.Timeout;
    
    if (waitingPopupOpen) {
      // Set timer to show notification after 5 seconds
      notificationTimer = setTimeout(() => {
        // Only show in demo mode - in real app this would come from a socket event
        if (!opponentSocketId) {
          setShowBetNotification(true);
        }
      }, 5000);
    } else {
      // Hide notification when waiting popup is closed
      setShowBetNotification(false);
    }
    
    // Clean up timer on unmount or when waitingPopupOpen changes
    return () => {
      if (notificationTimer) clearTimeout(notificationTimer);
    };
  }, [waitingPopupOpen, opponentSocketId]);

  // Handle notification actions
  const handleAcceptBet = () => {
    // In a real app, this would come from the socket event
    const challengeId = "demo-challenge-id";
    
    if (opponentSocketId) {
      // This is a real challenge
      betService.respondToBetChallenge(challengeId, true);
    } else {
      // Demo mode
      setShowBetNotification(false);
      setWaitingPopupOpen(false);
      // For demo purposes, we'll just navigate to play
      router.push('/play');
    }
  };

  const handleRejectBet = () => {
    // In a real app, this would come from the socket event
    const challengeId = "demo-challenge-id";
    
    if (opponentSocketId) {
      // This is a real challenge
      betService.respondToBetChallenge(challengeId, false);
    }
    
    setShowBetNotification(false);
    setWaitingPopupOpen(false);
  };

  // Handler to show info popup from notification
  const handleShowNotificationInfo = () => {
    if (selectedBetting === 0) setNotificationInfoPopup(0);
    else if (selectedBetting === 1) setNotificationInfoPopup(1);
    else if (selectedBetting === 2) setNotificationInfoPopup(2);
  };

  // Update the onClick handler for the "Send Request" button
  const handleSendRequest = () => {
    if (selectedBetting !== null) {
      // Show waiting popup immediately
      setWaitingPopupOpen(true);
      
      // Map UI bet type to API bet type
      let betType: BetType;
      switch (selectedBetting) {
        case 0:
          betType = BetType.PROFILE_CONTROL;
          break;
        case 1:
          betType = BetType.PROFILE_LOCK;
          break;
        case 2:
          betType = BetType.RATING_STAKE;
          break;
        default:
          betType = BetType.PROFILE_CONTROL;
      }
      
      // Map UI timer type to game mode
      const gameMode = selectedTimerType === 0 ? 'Bullet' : selectedTimerType === 1 ? 'Blitz' : 'Rapid';
      
      // Map timer to time control string
      const timeControl = selectedTimer === 0 ? '3+0' : selectedTimer === 1 ? '5+0' : '10+0';
      
      // Map play as to preferred side
      const preferredSide = selectedPlayAs === 0 ? 'white' : selectedPlayAs === 1 ? 'random' : 'black';
      
      // If we have an opponent socket ID or opponent ID, send direct challenge
      if (opponentSocketId) {
        sendBetChallenge({
          opponentSocketId,
          betType,
          stakeAmount: betType === BetType.RATING_STAKE ? selectedStake : undefined,
          gameMode,
          timeControl,
          preferredSide,
        });
      } else if (opponentId) {
        // If we have an opponent ID but no socket ID
        sendBetChallenge({
          opponentId,
          betType,
          stakeAmount: betType === BetType.RATING_STAKE ? selectedStake : undefined,
          gameMode,
          timeControl,
          preferredSide,
        });
      } else {
        // No valid opponent information
        console.log('No valid opponent information provided');
        // TODO: Add error handling or redirect
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start" style={{ background: BG_COLOR }}>
      {/* Add this just before rendering <BetChallengeNotification /> */}
      {showBetNotification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(34,38,38,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }} />
      )}
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
      {/* Bet Challenge Notification */}
      <BetChallengeNotification
        isOpen={showBetNotification}
        onAccept={handleAcceptBet}
        onReject={handleRejectBet}
        onShowInfo={handleShowNotificationInfo}
        challengerName={friend || "Opponent"}
        bettingType={selectedBetting === 0 ? "Temporary Profile Control" : 
                    selectedBetting === 1 ? "Temporary Profile Lock" : 
                    "Rating Stake"}
        ratingStake={selectedBetting === 2 ? selectedStake : undefined}
      />
      
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
      {/* Waiting Popup Overlay */}
      {waitingPopupOpen && !showBetNotification && (
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
              src="/images/profile_waiting_screen.png"
              alt="Opponent Avatar"
              width={64}
              height={64}
              style={{ borderRadius: '50%', marginBottom: 18, border: '4px solid #fff', background: '#fff' }}
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
              src="/images/atm_profile_avatar-icon.png"
              alt="friend avatar"
              width={32}
              height={32}
              className="rounded-full"
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
                  className="flex items-center rounded-xl px-3 py-3"
                  style={{ background: CARD_COLOR }}
                >
                  <span className="flex-1 text-[#FAF3DD] font-medium" style={{ fontSize: 15 }}>{opt.label}</span>
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
                      onClick={() => setOpenPopup(idx as 0 | 1 | 2)}
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
                    onClick={() => setSelectedBetting(selectedBetting === idx ? null : idx)}
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
                    {selectedBetting === idx ? (
                      <span style={{ color: "#FAF3DD", fontSize: 16 }}>✓</span>
                    ) : null}
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
              className="w-full py-3 font-semibold text-lg  send-request-btn"
              style={{
                background: selectedBetting !== null ? "#4A7C59" : BUTTON_DISABLED,
                color: selectedBetting !== null ? BUTTON_TEXT_ENABLED : BUTTON_TEXT_DISABLED,
                borderColor: selectedBetting !== null ? "#E9CB6B" : "#3A4A3A",
                borderWidth: 2,
                borderStyle: 'solid',
                borderRadius: 10,
                cursor: selectedBetting !== null ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
              disabled={selectedBetting === null}
              onClick={handleSendRequest}
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