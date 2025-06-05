import { Notification } from '../../context/NotificationsContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Fetch notifications from the API
 * @param limit - Number of notifications to fetch
 * @param offset - Offset for pagination
 * @param status - Filter by notification status
 */
export const fetchNotifications = async (
  limit: number = 20, 
  offset: number = 0, 
  status?: 'READ' | 'UNREAD'
): Promise<{ notifications: Notification[]; total: number }> => {
  try {
    // Build the query parameters
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${API_URL}/notifications?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      notifications: [],
      total: 0
    };
  }
};

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