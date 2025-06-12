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
  const auth = useAuth();
  const user = auth?.user;

  // Create and connect to the socket
  useEffect(() => {
    if (!user) return; // Don't connect if no user

    let notificationsSocket: Socket | null = null;

    const connectSocket = async () => {
      try {
        // Get Firebase token
        const token = await user.getIdToken();
        
        // Create socket connection
        notificationsSocket = io('http://localhost:3001', {
          path: '/socket.io', // Using default Socket.IO path
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          transports: ['websocket'],
          auth: {
            token // Send token in the initial connection
          }
        });

        // Set up socket event listeners
        notificationsSocket.on('connect', () => {
          console.log('Connected to notifications socket');
          
          // Authenticate with the socket server using Firebase token
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
        notificationsSocket.on('notification', (notification: any) => {
          console.log('Received new notification:', notification);
          // Transform the notification to match our interface
          const newNotification: Notification = {
            id: notification.id,
            type: notification.type,
            message: notification.data?.message || '',
            data: notification.data || {},
            timestamp: new Date(notification.createdAt || Date.now()),
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

    connectSocket();

    // Clean up on unmount
    return () => {
      if (notificationsSocket) {
        notificationsSocket.disconnect();
        setSocket(null);
      }
    };
  }, [user]);

  // Reconnect socket when the token might have changed
  useEffect(() => {
    const reconnectInterval = setInterval(async () => {
      if (socket && user) {
        try {
          const token = await user.getIdToken(true); // Force refresh token
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
  const markAsRead = (notificationId: string) => {
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => ({ ...notification, read: true }))
    );
  };

  // Get count of unread notifications
  const getUnreadCount = () => {
    return notifications.filter(notification => !notification.read).length;
  };

  // Delete a notification
  const deleteNotification = (notificationId: string) => {
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== notificationId)
    );
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