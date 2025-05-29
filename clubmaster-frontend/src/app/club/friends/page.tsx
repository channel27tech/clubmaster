"use client";
import React, { useState } from "react";
import { ShareLinkModal } from '../share-link/page';
import PlayerSelectionList from "../../components/players/PlayerSelectionList";

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
      />
      
      {showShareModal && (
        <ShareLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      )}
    </>
  );
} 