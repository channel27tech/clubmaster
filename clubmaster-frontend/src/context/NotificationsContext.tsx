'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Type definitions
export interface Notification {
  id: string;
  type: string;
  message: string;
  data: any;
  timestamp: Date;
  senderUserId?: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  totalUnread: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  getUnreadCount: () => number;
  addNotification: (notification: Notification) => void;
  deleteNotification: (notificationId: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user, loading } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Create and connect to the socket
  useEffect(() => {
    // Only proceed if Firebase auth is done loading AND we have a valid user
    if (loading || !user || !user.uid) {
      return;
    }

    let notificationsSocket: Socket | null = null;

    // Initial fetch of notifications
    const fetchNotifications = async () => {
      try {
        const token = user.isAnonymous ? `guest_${user.uid}` : await user.getIdToken();
        const url = `${API_URL}/notifications?limit=20`;
        console.log('Fetching notifications from:', url);
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications(
            data.notifications.map((n: any) => ({
              ...n,
              timestamp: new Date(n.createdAt),
              read: n.status === 'READ',
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    // Connect to WebSocket for real-time notifications
    const connectSocket = async () => {
      try {
        // Get token: use guest token for anonymous users
        let token: string;
        if (user.isAnonymous) {
          token = `guest_${user.uid}`;
        } else {
          token = await user.getIdToken();
        }
        
        // Create socket connection
        notificationsSocket = io(`${API_URL}/notifications`, {
          path: '/socket.io', // Using default Socket.IO path
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          transports: ['websocket'],
          query: {
            userId: user.uid // Add the userId as a query parameter
          },
          auth: {
            token // Send token in the initial connection
          }
        });

        // Set up socket event listeners
        notificationsSocket.on('connect', () => {
          console.log('Connected to notifications socket');
          
          // Authenticate with the socket server using token
          notificationsSocket?.emit('authenticate', { token });
          console.log('Notifications socket connection established:', notificationsSocket);
        });

        notificationsSocket.on('connect_error', (error) => {
          console.error('Notifications socket connection error:', error);
        });

        notificationsSocket.on('disconnect', (reason) => {
          console.log('Notifications socket disconnected:', reason);
        });

        // Listen for new notifications
        notificationsSocket.on('new_notification', (notification: any) => {
          console.log('Received new notification:', notification);
          // Transform the notification to match our interface
          const newNotification: Notification = {
            id: notification.id,
            type: notification.type,
            message: notification.message || notification.data?.message || '',
            data: notification.data || {},
            timestamp: new Date(notification.timestamp || Date.now()),
            senderUserId: notification.senderUserId,
            read: false
          };
          
          // Add to our state
          addNotification(newNotification);
        });

        setSocket(notificationsSocket);
      } catch (error) {
        console.error('Failed to initialize notification socket:', error);
      }
    };

    // Fetch initial notifications and connect to socket
    fetchNotifications();
    connectSocket();

    // Clean up on unmount
    return () => {
      if (notificationsSocket) {
        notificationsSocket.disconnect();
        setSocket(null);
      }
    };
  }, [user, API_URL]);

  // Reconnect socket when the token might have changed
  useEffect(() => {
    const reconnectInterval = setInterval(async () => {
      if (socket && user) {
        try {
          let token: string;
          if (user.isAnonymous) {
            token = `guest_${user.uid}`;
          } else {
            token = await user.getIdToken(true); // Force refresh token
          }
          socket.emit('authenticate', { token });
        } catch (error) {
          console.error('Failed to refresh authentication token:', error);
        }
      }
    }, 55 * 60 * 1000); // Refresh token every 55 minutes (Firebase tokens expire after 60 min)

    return () => clearInterval(reconnectInterval);
  }, [socket, user]);

  // Add a new notification
  const addNotification = (notification: Notification) => {
    setNotifications(prevNotifications => {
      // Check if this notification already exists
      if (prevNotifications.some(n => n.id === notification.id)) {
        return prevNotifications;
      }
      return [notification, ...prevNotifications];
    });
  };

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      // Only proceed if user is authenticated
      if (!user) return;
      
      const token = user.isAnonymous ? `guest_${user.uid}` : await user.getIdToken();
      const url = `${API_URL}/notifications/${notificationId}/read`;
      console.log('Marking notification as read:', url);
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      // Only proceed if user is authenticated
      if (!user) return;
      
      const token = user.isAnonymous ? `guest_${user.uid}` : await user.getIdToken();
      const url = `${API_URL}/notifications/read-all`;
      console.log('Marking all notifications as read:', url);
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Get count of unread notifications
  const getUnreadCount = () => {
    return notifications.filter(notification => !notification.read).length;
  };

  // Delete a notification
  const deleteNotification = async (notificationId: string) => {
    try {
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      
      // Only proceed if user is authenticated
      if (!user) return;
      
      const token = user.isAnonymous ? `guest_${user.uid}` : await user.getIdToken();
      const url = `${API_URL}/notifications/${notificationId}`;
      console.log('Deleting notification:', url);
      await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Calculate total unread count
  const totalUnread = getUnreadCount();

  const value = {
    notifications,
    totalUnread,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    addNotification,
    deleteNotification
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}; 