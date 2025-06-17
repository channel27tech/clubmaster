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
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('connection_established', (data) => {
    });

    // Listen for new notifications
    socketInstance.on('new_notification', (notification) => {
      
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

    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=20`);
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
      }
    };

    fetchNotifications();
  }, [user]);

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      // Call API to update server state
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    } catch (error) {
      // Revert optimistic update on error
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      // Call API to update server state
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, {
        method: 'PATCH',
      });
    } catch (error) {
    }
  };

  // Clear/delete a notification
  const clearNotification = async (notificationId: string) => {
    try {
      // Update local state optimistically
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );

      // Call API to delete from server
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
      });
    } catch (error) {
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