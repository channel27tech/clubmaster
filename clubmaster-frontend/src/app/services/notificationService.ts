import { Notification } from '../../context/NotificationsContext';
import { getAuth } from 'firebase/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch notifications from the API
 * @param limit - Number of notifications to fetch
 * @param offset - Offset for pagination
 * @param status - Filter by notification status
 */
export async function fetchNotifications(limit = 50, offset = 0, status?: 'READ' | 'UNREAD') {
  const auth = getAuth();
  let user = auth.currentUser;

  // Wait for user to be loaded if not available yet
  if (!user) {
    // Try to wait for Firebase to finish initializing
    await new Promise(resolve => setTimeout(resolve, 500));
    user = auth.currentUser;
  }

  if (!user) {
    console.warn('fetchNotifications: No authenticated user found.');
    return { notifications: [], total: 0 };
  }

  const token = await user.getIdToken();
  console.log('fetchNotifications: user', user);
  console.log('fetchNotifications: token', token);

  // Build the query parameters
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (status) {
    params.append('status', status);
  }
  const url = `${API_URL}/notifications?${params.toString()}`;
  console.log('Fetching notifications from:', url);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Transform the data to match the Notification interface
  const notifications: Notification[] = data.notifications.map((n: any) => ({
    id: n.id,
    type: n.type,
    message: n.data.message || '',
    data: n.data,
    timestamp: new Date(n.createdAt),
    senderUserId: n.senderUserId,
    read: n.status === 'READ'
  }));

  return {
    notifications,
    total: data.total
  };
}

/**
 * Mark a notification as read
 * @param notificationId - ID of the notification to mark as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to mark notification as read: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to mark all notifications as read: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

/**
 * Delete a notification
 * @param notificationId - ID of the notification to delete
 */
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to delete notification: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

// For notification actions
export const handleNotificationAction = async (
  notificationId: string, 
  action: string, 
  type: string
): Promise<boolean> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const token = await user.getIdToken();

    // Super admin transfer accept/decline
    if (type === 'SUPER_ADMIN_TRANSFER_REQUEST' && (action === 'accept' || action === 'reject')) {
      const endpoint = `${API_URL}/club-member/transfer-super-admin/${notificationId}/${action === 'accept' ? 'accept' : 'decline'}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to ${action} super admin transfer: ${response.status}`);
      }
      await markNotificationAsRead(notificationId);
      return true;
    }
    // Different actions based on notification type
    if (type.includes('TOURNAMENT') && action === 'accept') {
      // Accept tournament invitation
      const response = await fetch(`${API_URL}/tournaments/invitations/${notificationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to accept tournament invitation: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    } 
    else if (type.includes('TOURNAMENT') && action === 'reject') {
      // Reject tournament invitation
      const response = await fetch(`${API_URL}/tournaments/invitations/${notificationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reject tournament invitation: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    }
    else if (type === 'FRIEND_REQUEST' && action === 'accept') {
      // Accept friend request
      const response = await fetch(`${API_URL}/users/friends/requests/${notificationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to accept friend request: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    }
    else if (type === 'FRIEND_REQUEST' && action === 'reject') {
      // Reject friend request
      const response = await fetch(`${API_URL}/users/friends/requests/${notificationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reject friend request: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    }
    else if (type === 'GAME_INVITE' && action === 'accept') {
      // Accept game invitation
      const response = await fetch(`${API_URL}/game/invitations/${notificationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to accept game invitation: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    }
    else if (type === 'GAME_INVITE' && action === 'reject') {
      // Reject game invitation
      const response = await fetch(`${API_URL}/game/invitations/${notificationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reject game invitation: ${response.status}`);
      }
      
      // Mark notification as read after action
      await markNotificationAsRead(notificationId);
      return true;
    }
    
    // For view action, just mark as read
    if (action === 'view') {
      return await markNotificationAsRead(notificationId);
    }
    
    return false;
  } catch (error) {
    console.error(`Error handling notification action (${action}):`, error);
    return false;
  }
}; 