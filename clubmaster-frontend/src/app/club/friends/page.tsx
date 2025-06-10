"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ShareLinkModal } from '../share-link/page';
import PlayerSelectionList, { PlayerType } from "../../components/players/PlayerSelectionList";
import { useAuth } from "@/context/AuthContext";
import { fetchUsers, AppUser } from "@/services/userService";
import { useToast } from "@/hooks/useToast";
import { useActivity } from "@/context/ActivityContext";
import { UserActivityStatus } from "@/types/activity";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Extended player type with additional fields
interface ExtendedPlayerType extends PlayerType {
  originalDisplayName?: string;
  originalPhotoURL?: string;
  username?: string;
  custom_photo_base64?: string;
  effective_photo_url?: string;
}

// Extended AppUser interface to include custom photo
interface ExtendedAppUser extends AppUser {
  custom_photo_base64?: string;
  effective_photo_url?: string;
}

export default function ClubFriendsPage() {
  const [showShareModal, setShowShareModal] = useState(false);
  const { user } = useAuth();
  const [players, setPlayers] = useState<ExtendedPlayerType[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<ExtendedPlayerType[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { error: showErrorToast } = useToast();
  const isMounted = useRef(true);
  const { getUserActivityById, getTimeElapsed } = useActivity();
  const router = useRouter();

  // Fetch users function
  const getUsers = useCallback(async () => {
    if (!user || !isMounted.current) return;
    
    setIsLoading(true);
    try {
      const users = await fetchUsers(user);

      // Skip processing if component unmounted during fetch
      if (!isMounted.current) return;

      // Get Firebase ID token for authentication once for all requests
      const token = await user.getIdToken();

      // For each user, fetch their full profile data to get custom photo
      const enrichedUsers = await Promise.all(
        users.map(async (userItem) => {
          try {
            // Make API call to get full profile data using the current user's token
            const response = await fetch(`/api/profile/${userItem.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const profileData = await response.json();
              return {
                ...userItem,
                custom_photo_base64: profileData.custom_photo_base64,
                effective_photo_url: profileData.effective_photo_url
              };
            }
          } catch (error) {
            console.error(`Error fetching profile for user ${userItem.id}:`, error);
          }
          
          // Return original user if profile fetch fails
          return userItem;
        })
      );

      // Use activity data to enrich players list with real-time status and socketId
      const playersList: ExtendedPlayerType[] = enrichedUsers.map(userItem => {
        const activity = getUserActivityById(userItem.id);
        const isTrulyActive = activity ? 
          activity.status === UserActivityStatus.ONLINE || 
          activity.status === UserActivityStatus.IN_GAME : false;

        // Treat user as ExtendedAppUser to access custom_photo_base64
        const extendedUser = userItem as ExtendedAppUser;

        // Prioritize custom username over displayName from Google
        const displayName = userItem.username || userItem.displayName;

        // Determine which photo to use - use effective_photo_url first, then custom_photo_base64, then photoURL
        let photoToUse = extendedUser.effective_photo_url || extendedUser.custom_photo_base64 || userItem.photoURL;

        return {
          id: userItem.id,
          name: displayName,
          active: isTrulyActive, // Use real-time activity status
          lastActive: activity?.lastActive ? 
            getTimeElapsed(new Date(activity.lastActive)) : 
            userItem.lastActive, // Use real-time last active if available, fallback to fetched
          rating: userItem.rating,
          photoURL: photoToUse, // Use effective_photo_url or custom photo if available, otherwise Google photo
          socketId: activity?.socketId, // Add socketId from activity data
          // Store original data for debugging
          originalDisplayName: userItem.displayName,
          originalPhotoURL: userItem.photoURL,
          username: userItem.username,
          custom_photo_base64: extendedUser.custom_photo_base64,
          effective_photo_url: extendedUser.effective_photo_url
        };
      });

      console.log('Raw user data from API:', users);
      setPlayers(playersList);
      // Initially don't show any players until search
      setFilteredPlayers([]);
      console.log('Fetched and processed players:', playersList);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      if (isMounted.current) {
        showErrorToast("Failed to load players");
        setPlayers([]);
        setFilteredPlayers([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [user, getUserActivityById, getTimeElapsed, showErrorToast]);

  // Fetch users on component mount or when user changes
  useEffect(() => {
    // Set isMounted to true when component mounts
    isMounted.current = true;
    
    // Call getUsers only once on mount or when user changes
    if (user) {
      getUsers();
    } else {
      setIsLoading(false);
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [user]); // Remove getUsers from dependencies

  // Handle search term changes
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      // If search is empty, show no results
      setFilteredPlayers([]);
      return;
    }
    
    // Filter players based on search term
    const filtered = players.filter(player => 
      player.name.toLowerCase().includes(term.toLowerCase())
    );
    
    setFilteredPlayers(filtered);
  };

  // Dummy function for player action (no invite button needed)
  const handlePlayerAction = () => {};

  return (
    <>
      <CustomPlayerList
        headerTitle="Friends"
        onSearch={handleSearch}
        players={filteredPlayers}
        isLoading={isLoading}
        searchTerm={searchTerm}
      />

      {showShareModal && (
        <ShareLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      )}
    </>
  );
}

// Custom player list component that doesn't show action buttons
interface CustomPlayerListProps {
  headerTitle: string;
  onSearch: (term: string) => void;
  players: ExtendedPlayerType[];
  isLoading: boolean;
  searchTerm: string;
}

function CustomPlayerList({ 
  headerTitle, 
  onSearch, 
  players, 
  isLoading,
  searchTerm
}: CustomPlayerListProps) {
  const router = useRouter();
  
  const handleBackClick = () => {
    router.back();
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "#333939" }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: "#333939" }}>
        <div className="flex items-center ms-4 px-2 py-4 ">
          <button 
            onClick={handleBackClick} 
            className="text-[#BFC0C0] mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[26px] front-poppins front-semibold" style={{ color: "#FAF3DD", letterSpacing: 1 }}>{headerTitle}</h1>
          <span className="w-8" /> {/* Spacer for symmetry */}
        </div>
        {/* Search Bar */}
        <div className="px-4 py-2 sticky top-[56px] z-10" style={{ background: "#333939" }}>
          <div className="flex items-center rounded-lg px-3" style={{ background: "#4C5454" }}>
            <input
              className="flex-1 bg-transparent outline-none py-4 text-[#FAF3DD] placeholder-[#B0B0B0]"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => onSearch(e.target.value)}
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
        ) : searchTerm && players.length === 0 ? (
          <div className="text-center text-[#B0B0B0] mt-8">No players found.</div>
        ) : !searchTerm ? (
          <div className="text-center text-[#B0B0B0] mt-8">Search for players above.</div>
        ) : (
          players.map((player, idx) => (
            <PlayerCard 
              player={player} 
              key={player.id || player.name + idx} 
            />
          ))
        )}
      </div>
    </div>
  );
}

// Player card component without action button
function PlayerCard({ player }: { player: ExtendedPlayerType }) {
  // Use the useActivity hook to get real-time activity status
  const { getUserActivityById, getTimeElapsed } = useActivity();
  // Only get activity if player.id is defined
  const activity = player.id ? getUserActivityById(player.id) : undefined;
  const router = useRouter();

  // Determine if the user is currently active online or in-game
  const isTrulyActive = activity ? activity.status === UserActivityStatus.ONLINE || activity.status === UserActivityStatus.IN_GAME : false;

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
  } else if (player.lastActive) {
     displayStatusText = player.lastActive;
  } else {
    displayStatusText = "Offline";
  }

  // For debugging purposes
  console.log(`Player ${player.name} data:`, {
    displayedName: player.name,
    originalName: player.originalDisplayName,
    customUsername: player.username,
    photoURL: player.photoURL,
    effective_photo_url: player.effective_photo_url,
    custom_photo_base64: player.custom_photo_base64 ? 'Present (not shown)' : 'Not present',
    hasCustomPhoto: !!(player.effective_photo_url || player.custom_photo_base64)
  });

  // Determine if the photo URL is a base64 string or a custom photo
  const isBase64Image = player.photoURL?.startsWith('data:image');
  const isCustomPhoto = !!(player.effective_photo_url || player.custom_photo_base64);

  // Navigate to player profile page
  const handlePlayerClick = () => {
    if (player.id) {
      router.push(`/player/${player.id}`);
    }
  };

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-xl mb-3 relative cursor-pointer"
      style={{ background: "#4C5454" }}
      onClick={handlePlayerClick}
    >
      <div className="relative flex items-center justify-center" style={{ width: 48, height: 48, background: '#D9D9D9', borderRadius: '50%' }}>
        {player.photoURL ? (
          <Image
            src={player.photoURL}
            alt={player.name}
            width={48}
            height={48}
            className="rounded-full object-cover"
            unoptimized={isBase64Image || isCustomPhoto} // Skip image optimization for base64 and custom images
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
          <span className="text-[16px] front-roboto front-regular" style={{ color: "#FAF3DD" }}>{player.name}</span>
          {player.rating && (
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#8FC0A9", color: '#FFF' }}>
              {player.rating}
            </span>
          )}
        </div>
        {/* Display status text based on real-time activity */}
        <span className="text-xs" style={{ color: isTrulyActive ? "#8FC0A9" : "#E9CB6B" }}>
          {displayStatusText}
        </span>
      </div>
    </div>
  );
}

// Status dot component
function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: active ? "#8FC0A9" : "#E9CB6B",
        border: "2px solid #D9D9D9",
        position: "absolute",
        left: 35,
        bottom: 0,
      }}
    />
  );
}

// Note: The PlayerType interface and helper components like StatusDot and PlayerListItem
// are defined in clubmaster-frontend/src/app/components/players/PlayerSelectionList.tsx.
// You should ensure that the PlayerSelectionList component is used consistently
// if that is the desired approach. 