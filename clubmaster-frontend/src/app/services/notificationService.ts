import { Notification } from '../../context/NotificationsContext';
import { getAuth } from 'firebase/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch notifications from the API
 * @param limit - Number of notifications to fetch
 * @param offset - Offset for pagination
 * @param status - Filter by notification status (defaults to ALL)
 */
export const fetchNotifications = async (
  limit: number = 50, 
  offset: number = 0, 
  status: 'READ' | 'UNREAD' | 'PROCESSED' | 'ALL' = 'ALL'
): Promise<{ notifications: Notification[]; total: number }> => {
  try {
    // Build the query parameters
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (status && status !== 'ALL') {
      params.append('status', status);
    }

    // Get the current Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    console.log('fetchNotifications: user', user.uid);
    console.log('fetchNotifications: token exists', !!token);

    const url = `${API_URL}/notifications?${params.toString()}`;
    console.log('Fetching notifications from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      console.error(`Error response from API: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw API response:', data);
    
    if (!data.notifications || !Array.isArray(data.notifications)) {
      console.error('API returned invalid notifications format:', data);
      return { notifications: [], total: 0 };
    }
    
    // Transform the data to match the Notification interface
    const notifications: Notification[] = data.notifications.map((n: any) => {
      // Log the raw notification data for debugging
      console.log('Raw notification from server:', n);
      console.log('Raw notification type:', n.type);
      console.log('Raw notification data:', JSON.stringify(n.data || {}));
      
      // Ensure data is always an object
      const safeData = n.data || {};
      
      return {
        id: n.id,
        type: n.type,
        message: safeData.message || '',
        data: safeData,
        timestamp: new Date(n.createdAt || Date.now()),
        senderUserId: n.senderUserId,
        read: n.status === 'READ' || n.status === 'PROCESSED', 
        processed: n.status === 'PROCESSED'
      };
    });

    console.log(`Transformed ${notifications.length} notifications`);
    return {
      notifications,
      total: data.total || notifications.length
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      notifications: [],
      total: 0
    };
  }
}

/**
 * Mark a notification as read
 * @param notificationId - ID of the notification to mark as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    // Get the current Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    // Get the current Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    // Get the current Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    // Get the current Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();

    // Different actions based on notification type
    if (type.includes('TOURNAMENT') && action === 'accept') {
      // Accept tournament invitation
      const response = await fetch(`${API_URL}/tournaments/invitations/${notificationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      try {
        console.log(`Accepting friend request notification: ${notificationId}`);
        const response = await fetch(`${API_URL}/friends/accept/${notificationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error response from accept friend request:', errorData);
          throw new Error(`Failed to accept friend request: ${response.status} ${response.statusText}`);
        }
        
        // Mark notification as read after action
        await markNotificationAsRead(notificationId);
        return true;
      } catch (error) {
        console.error('Error accepting friend request:', error);
        return false;
      }
    }
    else if (type === 'FRIEND_REQUEST' && action === 'reject') {
      // Reject friend request
      try {
        console.log(`Rejecting friend request notification: ${notificationId}`);
        const response = await fetch(`${API_URL}/friends/reject/${notificationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error response from reject friend request:', errorData);
          throw new Error(`Failed to reject friend request: ${response.status} ${response.statusText}`);
        }
        
        // Mark notification as read after action
        await markNotificationAsRead(notificationId);
        return true;
      } catch (error) {
        console.error('Error rejecting friend request:', error);
        return false;
      }
    }
    else if (type === 'GAME_INVITE' && action === 'accept') {
      // Accept game invitation
      const response = await fetch(`${API_URL}/game/invitations/${notificationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    
    // Default case for unknown actions
    console.warn(`Unknown notification action combination: type=${type}, action=${action}`);
    return false;
  } catch (error) {
    console.error(`Error handling notification action (${action}):`, error);
    return false;
  }
};