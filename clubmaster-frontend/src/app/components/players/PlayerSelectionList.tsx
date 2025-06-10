"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useActivity } from "@/context/ActivityContext";
import { UserActivityStatus } from "@/types/activity";

// Color codes
const TITLE_COLOR = "#FAF3DD";
const ACTIVE_COLOR = "#8FC0A9";
const INACTIVE_COLOR = "#E9CB6B";
const BG_COLOR = "#333939";
const CARD_COLOR = "#4C5454";
const SEARCH_BG = "#4C5454";
const BUTTON_BG = "#4A7C59";
const BUTTON_TEXT = "#FAF3DD";

// Player type definition
export interface PlayerType {
  id?: string;
  name: string;
  active: boolean;
  lastActive?: string;
  photoURL?: string;
  rating?: number;
  socketId?: string;
}

// This component is used to display a status dot
interface StatusDotProps {
  active: boolean;
}

function StatusDot({ active }: StatusDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: active ? ACTIVE_COLOR : INACTIVE_COLOR,
        border: "2px solid #D9D9D9",
        position: "absolute",
        left: 35,
        bottom: 0,
      }}
    />
  );
}

// This interface is used to define the type of the player list item
interface PlayerListItemProps {
  player: PlayerType;
  onAction: (player: PlayerType) => void;
  showActionButton: boolean;
  buttonText: string;
  cardClickable: boolean;
}

function PlayerListItem({ player, onAction, showActionButton, buttonText, cardClickable }: PlayerListItemProps) {
  // Use the useActivity hook to get real-time activity status
  const { getUserActivityById, getTimeElapsed } = useActivity();
  // Only get activity if player.id is defined
  const activity = player.id ? getUserActivityById(player.id) : undefined;

  // Determine if the user is currently active online or in-game
  const isTrulyActive = activity ? activity.status === UserActivityStatus.ONLINE || activity.status === UserActivityStatus.IN_GAME : false; // Default to false if no activity data yet

  // Determine the status text to display based on real-time activity
  let displayStatusText;
  if (activity) {
    if (activity.status === UserActivityStatus.ONLINE) {
      displayStatusText = "Active now";
    } else if (activity.lastActive) {
      displayStatusText = getTimeElapsed(activity.lastActive);
    } else {
      displayStatusText = "Offline";
    }
  } else if (player.lastActive) { // Fallback to initial lastActive if no activity data from context yet
     displayStatusText = player.lastActive;
  } else {
    displayStatusText = "Offline"; // Final fallback
  }

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl mb-3 relative ${cardClickable ? 'hover:bg-[#5A5E5E] transition-colors' : ''}`}
      style={{ 
        background: CARD_COLOR, 
        cursor: cardClickable ? 'pointer' : 'default'
      }}
      onClick={cardClickable ? () => onAction(player) : undefined}
    >
      <div className="relative flex items-center justify-center" style={{ width: 48, height: 48, background: '#D9D9D9', borderRadius: '50%' }}>
        {player.photoURL ? (
          <Image
            src={player.photoURL}
            alt={player.name}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        ) : (
          <Image
            src="/images/frnds dp.svg"
            alt="profile"
            width={24}
            height={28}
          />
        )}
        <StatusDot active={isTrulyActive} />
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex items-center">
          <span className="text-[16px] front-roboto front-regular" style={{ color: TITLE_COLOR }}>{player.name}</span>
          {player.rating && (
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: ACTIVE_COLOR, color: '#FFF' }}>
              {player.rating}
            </span>
          )}
        </div>
        {/* Display status text based on real-time activity */}
        <span className="text-xs" style={{ color: isTrulyActive ? ACTIVE_COLOR : INACTIVE_COLOR }}>
          {displayStatusText}
        </span>
      </div>
      {showActionButton && (
        <button
          className="ml-auto px-4 py-2 rounded-md text-sm font-medium"
          style={{ backgroundColor: BUTTON_BG, color: BUTTON_TEXT }}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the parent div's onClick
            onAction(player);
          }}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

interface PlayerSelectionListProps {
  headerTitle: string;
  showActionButton?: boolean;
  buttonText?: string;
  onPlayerAction: (player: PlayerType) => void;
  onBackClick?: () => void;
  players?: PlayerType[];
  mode?: 'friends' | 'opponents';
  cardClickable?: boolean;
  isLoading?: boolean;
}

export default function PlayerSelectionList({
  headerTitle = "Friends",
  showActionButton = true,
  buttonText = "Invite",
  onPlayerAction,
  onBackClick,
  players = [],
  mode = 'friends',
  cardClickable = false,
  isLoading = false
}: PlayerSelectionListProps) {
  const [search, setSearch] = useState("");
  const router = useRouter();
  
  const filtered = useMemo(
    () =>
      players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search, players]
  );
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.back();
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ background: BG_COLOR }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: BG_COLOR }}>
        <div className="flex items-center ms-4 px-2 py-4 ">
          <button 
            onClick={handleBackClick} 
            className="text-[#BFC0C0] mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[26px] front-poppins front-semibold" style={{ color: TITLE_COLOR, letterSpacing: 1 }}>{headerTitle}</h1>
          <span className="w-8" /> {/* Spacer for symmetry */}
        </div>
        {/* Search Bar */}
        <div className="px-4 py-2 sticky top-[56px] z-10" style={{ background: BG_COLOR }}>
          <div className="flex items-center rounded-lg px-3" style={{ background: SEARCH_BG }}>
            <input
              className="flex-1 bg-transparent outline-none py-4 text-[#FAF3DD] placeholder-[#B0B0B0]"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 16 }}
            />
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" stroke="#B0B0B0" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
      {/* Players List */}
      <div className="px-4 pt-2 pb-8" style={{ maxWidth: 480, margin: "0 auto" }}>
        {isLoading ? (
          <div className="text-center text-[#B0B0B0] mt-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-[#B0B0B0] mt-8">No {mode === 'friends' ? 'friends' : 'players'} found.</div>
        ) : (
          filtered.map((player, idx) => (
            <PlayerListItem 
              player={player} 
              key={player.id || player.name + idx} 
              onAction={onPlayerAction}
              showActionButton={showActionButton}
              buttonText={buttonText}
              cardClickable={cardClickable}
            />
          ))
        )}
      </div>
      <style jsx global>{`
        @media (max-width: 600px) {
          .min-h-screen { min-height: 100vh; }
          .text-xl { font-size: 1.2rem; }
          .text-base { font-size: 1rem; }
        }
        @media (min-width: 601px) {
          .px-4 { padding-left: 2rem; padding-right: 2rem; }
          .pt-2 { padding-top: 1rem; }
          .pb-8 { padding-bottom: 2rem; }
        }
      `}</style>
    </div>
  );
} 