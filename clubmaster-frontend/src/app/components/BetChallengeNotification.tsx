'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface BetChallengeNotificationProps {
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
  onShowInfo: () => void;
  challengerName: string;
  challengerRating?: number;
  challengerCountryCode?: string;
  challengerProfileImage?: string;
  bettingType: 'Temporary Profile Lock' | 'Temporary Profile Control' | 'Rating Stake';
  ratingStake?: number;
  timeRemaining?: number;
}

const BetChallengeNotification: React.FC<BetChallengeNotificationProps> = ({
  isOpen,
  onAccept,
  onReject,
  onShowInfo,
  challengerName,
  challengerRating,
  challengerCountryCode,
  challengerProfileImage = '/images/profile_waiting_screen.png',
  bettingType,
  ratingStake,
  timeRemaining
}) => {
  const notificationRef = useRef<HTMLDivElement>(null);
  const [flagError, setFlagError] = useState(false);

  // Optional: Play notification sound when opened
  useEffect(() => {
    if (isOpen) {
      console.log('[BetChallengeNotification] Notification opened, playing sound');
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(e => console.log('[BetChallengeNotification] Error playing notification sound:', e));
    }
  }, [isOpen]);

  // Focus trap inside notification when open
  useEffect(() => {
    if (isOpen && notificationRef.current) {
      console.log('[BetChallengeNotification] Setting focus in notification dialog');
      const focusableElements = notificationRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  // Reset flag error when component reopens with possibly different country
  useEffect(() => {
    if (isOpen) {
      setFlagError(false);
    }
  }, [isOpen, challengerCountryCode]);

  // Log when notification should open or close
  useEffect(() => {
    console.log(`[BetChallengeNotification] Notification visibility changed to: ${isOpen ? 'visible' : 'hidden'}`);
    console.log(`[BetChallengeNotification] Challenger: ${challengerName}, Bet type: ${bettingType}`);
    // Add more detailed debugging
    if (isOpen) {
      console.log(`[BetChallengeNotification] ========== DETAILED DEBUG ==========`);
      console.log(`[BetChallengeNotification] Challenger name received: "${challengerName}"`);
      console.log(`[BetChallengeNotification] Challenger name length: ${challengerName ? challengerName.length : 0}`);
      console.log(`[BetChallengeNotification] Challenger name type: ${typeof challengerName}`);
      console.log(`[BetChallengeNotification] Is name undefined? ${challengerName === undefined}`);
      console.log(`[BetChallengeNotification] Is name null? ${challengerName === null}`);
      console.log(`[BetChallengeNotification] Is name empty string? ${challengerName === ""}`);
      console.log(`[BetChallengeNotification] Profile image URL: ${challengerProfileImage}`);
      console.log(`[BetChallengeNotification] Is using default image? ${challengerProfileImage === '/images/profile_waiting_screen.png'}`);
      console.log(`[BetChallengeNotification] ======================================`);
    }
  }, [isOpen, challengerName, bettingType, challengerProfileImage]);

  if (!isOpen) return null;

  // Safe wrapper for accept/reject to prevent errors
  const handleAccept = () => {
    console.log('[BetChallengeNotification] Accept button clicked');
    try {
      onAccept();
    } catch (error) {
      console.error('[BetChallengeNotification] Error in accept handler:', error);
    }
  };

  const handleReject = () => {
    console.log('[BetChallengeNotification] Reject button clicked');
    try {
      onReject();
    } catch (error) {
      console.error('[BetChallengeNotification] Error in reject handler:', error);
    }
  };

  const handleShowInfo = () => {
    console.log('[BetChallengeNotification] Show info button clicked');
    try {
      onShowInfo();
    } catch (error) {
      console.error('[BetChallengeNotification] Error in show info handler:', error);
    }
  };

  return (
    <div 
      className="fixed top-0 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-md"
      role="alert"
      ref={notificationRef}
    >
      <div className="rounded-lg overflow-hidden shadow-xl" style={{ background: '#1F2323' }}>
        {/* Header with profile and info */}
        <div className="p-4">
          <div className="flex items-center">
            {/* Challenger profile picture */}
            <div className="mr-4">
              <Image 
                src={challengerProfileImage}
                alt={`${challengerName}'s profile`}
                width={64}
                height={64}
                style={{ borderRadius: '50%', border: '2px solid #fff' }}
                onError={() => console.warn('[BetChallengeNotification] Profile image failed to load')}
              />
            </div>
            
            {/* Challenge info */}
            <div>
              <h3 className="text-[16px] font-semibold font-poppins text-[#FAF3DD]">
                {challengerName} is challenging to a bet match!
              </h3>
              
              <div className="flex items-center mt-1">
                <span className="text-[#D9D9D9] font-roboto text-[16px] mr-2">{challengerName}</span>
                {challengerRating && (
                  <span className="text-[#D9D9D9] text-[16px] font-roboto mr-2">({challengerRating})</span>
                )}
                {challengerCountryCode && !flagError ? (
                  <Image 
                    src={challengerCountryCode.toLowerCase() === 'in' 
                      ? `/images/atm_flage_india.svg` 
                      : `/images/flags/${challengerCountryCode.toLowerCase()}.svg`}
                    alt={challengerCountryCode}
                    width={24}
                    height={16}
                    style={{ display: 'inline-block' }}
                    onError={() => setFlagError(true)}
                  />
                ) : challengerCountryCode ? (
                  <span className="inline-block text-[#D9D9D9] text-[14px]">
                    {challengerCountryCode.toUpperCase()}
                  </span>
                ) : null}
              </div>
              
              <div className="flex items-center mt-1">
                <span className="text-[#D9D9D9]">{bettingType}</span>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "#4A7C59",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 18,
                    border: 'none',
                    marginLeft: 12,
                    cursor: 'pointer',
                  }}
                  aria-label={`Show info for ${bettingType}`}
                  onClick={handleShowInfo}
                >
                  ?
                </button>
                {bettingType === 'Rating Stake' && ratingStake && (
                  <span className="text-[#D9D9D9] ml-2">(Stake: {ratingStake})</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Countdown timer if provided */}
          {timeRemaining !== undefined && (
            <div className="mt-2 text-sm text-[#D9D9D9]">
              Expires in {timeRemaining} seconds
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex p-4 space-x-4">
          <button 
            className="flex-1 py-4 font-semibold text-lg rounded-lg"
            style={{ 
              background: '#4A7C59', 
              color: '#FAF3DD',
              border: '2px solid #E9CB6B',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={handleAccept}
          >
            Accept
          </button>
          <button 
            className="flex-1 py-4 font-semibold text-lg rounded-lg" 
            style={{ 
              background: 'transparent', 
              color: '#FAF3DD',
              border: '2px solid #4A7C59',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetChallengeNotification; 