import { FriendsService } from '../services/FriendsService';
import toast from 'react-hot-toast';

/**
 * Validates if a string is a valid Firebase UID
 * @param id The ID to check
 * @returns boolean indicating if it's a valid Firebase UID format
 */
export function isValidFirebaseUID(id: string): boolean {
  // Firebase UIDs are typically 28 characters, but can vary
  // They're alphanumeric and we'll allow a range of 20-36 chars to be safe
  return /^[a-zA-Z0-9]{20,36}$/.test(id);
}

/**
 * Check if the current user is friends with another user
 * @param userId - The current user's ID (not used anymore, kept for compatibility)
 * @param friendId - The potential friend's ID
 * @returns Promise<boolean> - Whether the users are friends
 */
export async function checkIfFriends(userId: string, friendId: string): Promise<boolean> {
  try {
    if (!isValidFirebaseUID(friendId)) {
      console.error('Invalid friendId format:', friendId);
      return false;
    }
    
    return await FriendsService.checkFriendship(friendId);
  } catch (error) {
    console.error('Failed to check friend status:', error);
    return false;
  }
}

/**
 * Check if there's a pending friend request to another user
 * @param friendId - The potential friend's ID
 * @returns Promise<boolean> - Whether there is a pending request
 */
export async function checkPendingRequest(friendId: string): Promise<boolean> {
  try {
    if (!isValidFirebaseUID(friendId)) {
      console.error('Invalid friendId format:', friendId);
      return false;
    }
    
    return await FriendsService.checkPendingRequest(friendId);
  } catch (error) {
    console.error('Failed to check pending request status:', error);
    return false;
  }
}

/**
 * Add a user as a friend
 * @param friendId - The ID of the user to add as a friend
 * @returns Promise<boolean> - Whether the friend was added successfully
 */
export async function addFriend(friendId: string): Promise<boolean> {
  try {
    if (!isValidFirebaseUID(friendId)) {
      const errorMsg = `Invalid friendId format: ${friendId}. Must be a Firebase UID.`;
      console.error(errorMsg);
      toast.error(errorMsg);
      return false;
    }
    
    console.log('Sending friend request with friendId:', friendId);
    await FriendsService.sendFriendRequest(friendId);
    return true;
  } catch (error) {
    console.error('Failed to add friend:', error);
    return false;
  }
} 