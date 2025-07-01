"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import PlayerSelectionList, { PlayerType } from "@/app/components/players/PlayerSelectionList";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";
import { fetchUsers } from "@/services/userService";
import { useToast } from "@/hooks/useToast";
import { useActivity } from "@/context/ActivityContext";
import { UserActivityStatus } from "@/types/activity";

// This page is used to select an opponent for a bet
export default function BetOpponentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [players, setPlayers] = useState<PlayerType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error: showErrorToast } = useToast();
  const isMounted = useRef(true);
  const isLoadingRef = useRef(true);
  const playersRef = useRef<PlayerType[]>([]);
  
  const { getUserActivityById, getTimeElapsed } = useActivity();
  
  // Fetch initial list of users (potential opponents)
  const getUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const users = await fetchUsers(user);

      // Use activity data to enrich players list with real-time status and socketId
      const playersList: PlayerType[] = users.map(user => {
        const activity = getUserActivityById(user.id);
        const isTrulyActive = activity ? activity.status === UserActivityStatus.ONLINE || activity.status === UserActivityStatus.IN_GAME : false;

        return {
          id: user.id,
          name: user.displayName,
          active: isTrulyActive, // Use real-time activity status
          lastActive: activity?.lastActive ? getTimeElapsed(new Date(activity.lastActive)) : user.lastActive, // Use real-time last active if available, fallback to fetched
          rating: user.rating,
          photoURL: user.photoURL,
          socketId: activity?.socketId, // Add socketId from activity data
          firebaseUid: user.firebaseUid, // Add firebaseUid if it's in the user object
        };
      });

      setPlayers(playersList);
      playersRef.current = playersList;
      console.log('Fetched and processed players:', playersList);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      showErrorToast("Failed to load players");
      setPlayers([]);
      playersRef.current = [];
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [user, getUserActivityById, getTimeElapsed, showErrorToast]); // Keep dependencies for useCallback correctness
  
  // Fetch users on component mount or when user changes
  useEffect(() => {
    // Set isMounted to true when component mounts
    isMounted.current = true;
    
    if (user) {
      getUsers(); // Call the memoized getUsers function
    } else {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [user]); // Depend only on user
  
  // Handle player selection
  const handleSelectOpponent = useCallback((player: PlayerType) => {
    // Navigate to the match setup screen, passing opponent details including socketId
    router.push(`/bet/match_setup_screen?opponent=${player.name}&opponentId=${player.id}${player.socketId ? `&socketId=${player.socketId}` : ''}`);
  }, [router]);

  return (
    <PlayerSelectionList
      headerTitle="Select Opponent"
      showActionButton={false}
      buttonText="Select"
      onPlayerAction={handleSelectOpponent}
      mode="opponents"
      cardClickable={true}
      players={players}
      isLoading={isLoading}
    />
  );
} 