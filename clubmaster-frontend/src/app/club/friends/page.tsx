"use client";
import React, { useState } from "react";
import { ShareLinkModal } from '../share-link/page';
import PlayerSelectionList from "../../components/players/PlayerSelectionList";
// import { useRouter, useSearchParams } from 'next/navigation'; // Removed unused imports

export default function ClubFriendsPage() {
  const [showShareModal, setShowShareModal] = useState(false);

  // Handle invite action (opens share modal)
  const handleInvite = () => {
    setShowShareModal(true);
  };

  return (
    <>
      <PlayerSelectionList
        headerTitle="Friends"
        showActionButton={true}
        buttonText="Invite"
        onPlayerAction={handleInvite}
        mode="friends"
        // Assuming PlayerSelectionList handles fetching friends based on mode internally
        // If it requires a players prop, you would fetch friends here and pass them.
      />

      {showShareModal && (
        <ShareLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      )}
    </>
  );
}

// Note: The PlayerType interface and helper components like StatusDot and PlayerListItem
// are defined in clubmaster-frontend/src/app/components/players/PlayerSelectionList.tsx.
// You should ensure that the PlayerSelectionList component is used consistently
// if that is the desired approach. 