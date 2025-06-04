/**
 * Check if the current user is friends with another user
 * @param userId - The current user's ID
 * @param friendId - The potential friend's ID
 * @returns Promise<boolean> - Whether the users are friends
 */
export async function checkIfFriends(userId: string, friendId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/friends/check?userId=${userId}&friendId=${friendId}`);
    
    if (!response.ok) {
      console.error('Failed to check friend status:', response.statusText);
      return false;
    }
    
    const data = await response.json();
    return data.isFriend;
  } catch (error) {
    console.error('Error checking friend status:', error);
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
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ friendId }),
    });
    
    if (!response.ok) {
      console.error('Failed to add friend:', response.statusText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error adding friend:', error);
    return false;
  }
} 