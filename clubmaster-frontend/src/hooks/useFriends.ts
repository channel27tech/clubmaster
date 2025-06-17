import { useState, useEffect, useCallback } from 'react';
import { Friend, FriendsService } from '../services/FriendsService';

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const friendsList = await FriendsService.getFriends();
      setFriends(friendsList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch friends');
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is friends with another user
  const checkFriendship = useCallback(async (friendId: string): Promise<boolean> => {
    try {
      return await FriendsService.checkFriendship(friendId);
    } catch (err) {
      console.error('Error checking friendship:', err);
      return false;
    }
  }, []);

  // Send friend request
  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      await FriendsService.sendFriendRequest(friendId);
      // No need to update friends list here as the request is just pending
      return true;
    } catch (err) {
      console.error('Error sending friend request:', err);
      return false;
    }
  }, []);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (notificationId: string) => {
    try {
      await FriendsService.acceptFriendRequest(notificationId);
      // Refetch friends list to include the newly accepted friend
      fetchFriends();
      return true;
    } catch (err) {
      console.error('Error accepting friend request:', err);
      return false;
    }
  }, [fetchFriends]);

  // Reject friend request
  const rejectFriendRequest = useCallback(async (notificationId: string) => {
    try {
      await FriendsService.rejectFriendRequest(notificationId);
      // No need to update friends list as the request was rejected
      return true;
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      return false;
    }
  }, []);

  // Load friends on component mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  return {
    friends,
    loading,
    error,
    fetchFriends,
    checkFriendship,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest
  };
} 