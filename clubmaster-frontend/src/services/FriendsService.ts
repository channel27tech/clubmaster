import toast from 'react-hot-toast';
import api from '../utils/api';

export interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
}

export class FriendsService {
  /**
   * Send a friend request to another user
   * @param friendId The ID of the user to send the request to
   * @returns Promise resolving to success message
   */
  static async sendFriendRequest(friendId: string): Promise<{ message: string }> {
    try {
      const response = await api.post('/api/friends', { friendId });
      toast.success('Friend request sent successfully');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to send friend request';
      toast.error(errorMessage);
      console.error('Failed to add friend:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get the current user's friends list
   * @returns Promise resolving to an array of friends
   */
  static async getFriends(): Promise<Friend[]> {
    try {
      const response = await api.get('/api/friends');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to get friends list';
      toast.error(errorMessage);
      console.error('Failed to get friends list:', errorMessage);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Check if the current user is friends with another user
   * @param friendId The ID of the user to check friendship with
   * @returns Promise resolving to a boolean indicating friendship status
   */
  static async checkFriendship(friendId: string): Promise<boolean> {
    try {
      const response = await api.get(`/api/friends/check?friendId=${friendId}`);
      return response.data.areFriends;
    } catch (error: any) {
      console.error('Failed to check friend status:', error.message);
      // Default to false on error
      return false;
    }
  }

  /**
   * Accept a friend request
   * @param notificationId The ID of the notification for the friend request
   * @returns Promise resolving to success message
   */
  static async acceptFriendRequest(notificationId: string): Promise<{ message: string }> {
    try {
      const response = await api.patch(`/api/friends/accept/${notificationId}`);
      toast.success('Friend request accepted');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to accept friend request';
      toast.error(errorMessage);
      console.error('Failed to accept friend request:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Reject a friend request
   * @param notificationId The ID of the notification for the friend request
   * @returns Promise resolving to success message
   */
  static async rejectFriendRequest(notificationId: string): Promise<{ message: string }> {
    try {
      const response = await api.patch(`/api/friends/reject/${notificationId}`);
      toast.success('Friend request rejected');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to reject friend request';
      toast.error(errorMessage);
      console.error('Failed to reject friend request:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if there's a pending friend request to the specified user
   * @param friendId The ID of the user to check for pending requests
   * @returns Promise resolving to a boolean indicating if a request is pending
   */
  static async checkPendingRequest(friendId: string): Promise<boolean> {
    try {
      const response = await api.get(`/api/friends/pending?friendId=${friendId}`);
      return response.data.isPending;
    } catch (error: any) {
      console.error('Failed to check pending request status:', error.message);
      // Default to false on error
      return false;
    }
  }
} 