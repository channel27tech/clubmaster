'use client';

import React, { useEffect } from 'react';
import { useBet } from '@/context/BetContext';
import BetChallengeNotification from './BetChallengeNotification';
import { BetType } from '@/types/bet';

/**
 * GlobalNotifications component that renders app-wide notifications
 * Placed at the root level to ensure notifications appear on any page
 */
const GlobalNotifications: React.FC = () => {
  const { 
    currentBetChallenge, 
    isShowingBetNotification, 
    acceptBetChallenge, 
    rejectBetChallenge 
  } = useBet();

  // Handler for the info button click - now handled within BetChallengeNotification
  const handleShowNotificationInfo = () => {
    // This function is now just a placeholder to satisfy the interface
    // The actual popup is handled within the BetChallengeNotification component
    console.log('[GlobalNotifications] Info button clicked for bet type:', 
      currentBetChallenge?.betType);
  };

  // Add debug logging when the notification should be shown
  useEffect(() => {
    if (isShowingBetNotification && currentBetChallenge) {
      console.log('[GlobalNotifications] Rendering notification with challenger name:', currentBetChallenge.challengerName);
      console.log('[GlobalNotifications] Full challenge data:', currentBetChallenge);
    }
  }, [isShowingBetNotification, currentBetChallenge]);

  return (
    <>
      {/* Bet Challenge Notification - Now available globally */}
      {isShowingBetNotification && currentBetChallenge && (
        <BetChallengeNotification
          isOpen={isShowingBetNotification}
          onAccept={() => acceptBetChallenge(currentBetChallenge.id)}
          onReject={() => rejectBetChallenge(currentBetChallenge.id)}
          onShowInfo={handleShowNotificationInfo}
          challengerName={currentBetChallenge.challengerName || currentBetChallenge.senderUsername || "Unknown Player"}
          challengerRating={currentBetChallenge.challengerRating}
          challengerProfileImage={
            currentBetChallenge.challengerPhotoURL || 
            currentBetChallenge.senderPhotoURL || 
            undefined  // Let the component use its default fallback
          }
          bettingType={currentBetChallenge.betType === BetType.PROFILE_CONTROL ? "Temporary Profile Control" :
                      currentBetChallenge.betType === BetType.PROFILE_LOCK ? "Temporary Profile Lock" :
                      "Rating Stake"}
          ratingStake={currentBetChallenge.betType === BetType.RATING_STAKE ? currentBetChallenge.stakeAmount : undefined}
        />
      )}
    </>
  );
};

export default GlobalNotifications; 