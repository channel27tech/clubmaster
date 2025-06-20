'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext'; // Fix: Updated import path

// Define the shape of a notification
export interface Notification {
  id: string;
  type: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
  senderUserId?: string;
  read: boolean;
}

// Define the context shape
interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
}

// Create context with default values
const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  connected: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotification: () => {},
});

// Custom hook to use the notifications context
export const useNotifications = () => useContext(NotificationsContext);

// Provider component
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Get auth context safely with fallback for SSR or missing provider
  const auth = useAuth?.() || { user: null };
  const user = auth.user;
  
  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Initialize socket connection
  useEffect(() => {
    // Check if user is authenticated and has an ID property
    if (!user || !user.uid) {
      console.log('User not authenticated or missing uid, skipping socket connection');
      return;
    }

    const userId = user.uid; // Use UID from Firebase auth

    // Connect to the notifications namespace with user ID
    const socketInstance = io(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
      query: { userId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to notifications socket');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from notifications socket');
      setConnected(false);
    });

    socketInstance.on('connection_established', (data) => {
      console.log('Notifications socket connection established:', data);
    });

    // Listen for new notifications
    socketInstance.on('new_notification', (notification) => {
      console.log('New notification received:', notification);
      
      // Add the notification to our state with read=false
      setNotifications(prev => [
        {
          ...notification,
          timestamp: new Date(notification.timestamp),
          read: false,
        },
        ...prev, // Add new notifications to the beginning of the array
      ]);

      // You could also show a toast/alert here
    });

    // Store socket instance
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  // Fetch initial notifications from API
  useEffect(() => {
    // Check if user is authenticated and has an ID property
    if (!user || !user.uid) {
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const fetchNotifications = async () => {
      try {
        const url = `${API_URL}/notifications?limit=20`;
        console.log('Fetching notifications from:', url);
        const response = await fetch(url);
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

    fetchNotifications();
  }, [user]);

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${API_URL}/notifications/${notificationId}/read`;
      console.log('Marking notification as read:', url);
      await fetch(url, {
        method: 'PATCH',
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${API_URL}/notifications/read-all`;
      console.log('Marking all notifications as read:', url);
      await fetch(url, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Clear/delete a notification
  const clearNotification = async (notificationId: string) => {
    try {
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${API_URL}/notifications/${notificationId}`;
      console.log('Deleting notification:', url);
      await fetch(url, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Context value
  const value = {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    markAllAsRead,
    clearNotification,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext; 