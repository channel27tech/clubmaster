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

  // State for the notification info popup - keeping the setter for handleShowNotificationInfo
  const [, setNotificationInfoPopup] = React.useState<null | 0 | 1 | 2>(null);

  // Handler to show info popup from notification
  const handleShowNotificationInfo = () => {
    if (currentBetChallenge) {
      switch (currentBetChallenge.betType) {
        case BetType.PROFILE_CONTROL:
          setNotificationInfoPopup(0);
          break;
        case BetType.PROFILE_LOCK:
          setNotificationInfoPopup(1);
          break;
        case BetType.RATING_STAKE:
          setNotificationInfoPopup(2);
          break;
        default:
          setNotificationInfoPopup(null);
      }
    }
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
          challengerProfileImage={currentBetChallenge.challengerPhotoURL || '/images/profile_waiting_screen.png'}
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