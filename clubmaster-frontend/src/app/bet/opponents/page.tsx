"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import PlayerSelectionList, { PlayerType } from "../../components/players/PlayerSelectionList";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";
import { fetchUsers } from "@/services/userService";
import { useToast } from "@/hooks/useToast";

// This page is used to select an opponent for a bet
export default function BetOpponentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [players, setPlayers] = useState<PlayerType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const isMounted = useRef(true);
  const isLoadingRef = useRef(true);
  const playersRef = useRef<PlayerType[]>([]);
  
  // Define getUsers as a useCallback to avoid recreating it on every render
  const getUsers = useCallback(async () => {
    // Skip if already loading or no user is logged in
    if (!user || !isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      
      const users = await fetchUsers(user);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        // Map AppUser to PlayerType
        const playersList: PlayerType[] = users.map(user => ({
          id: user.id,
          name: user.displayName,
          // active and lastActive will now be derived from ActivityContext in PlayerListItem
          // We initialize them here to satisfy the PlayerType interface
          active: false,
          lastActive: undefined,
          rating: user.rating,
          photoURL: user.photoURL
        }));
        
        setPlayers(playersList);
        playersRef.current = playersList;
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      // Show error toast if available
      if (toast?.error && isMounted.current) {
        toast.error("Failed to load users. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [user]); // Only depend on user
  
  // Fetch users on component mount
  useEffect(() => {
    // Set isMounted to true when component mounts
    isMounted.current = true;
    
    if (user) {
      getUsers();
    } else {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [user, getUsers]); // getUsers is now memoized with useCallback
  
  // Handle player selection - navigate to player profile
  const handlePlayerSelect = (player: PlayerType) => {
    if (player.id) {
      router.push(`/player/${encodeURIComponent(player.id)}`);
    }
  };

  return (
    <PlayerSelectionList
      headerTitle="Select Opponent"
      showActionButton={false}
      buttonText="Select"
      onPlayerAction={handlePlayerSelect}
      mode="opponents"
      cardClickable={true}
      players={players}
      isLoading={isLoading}
    />
  );
} 