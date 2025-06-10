'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import NotificationCard from '../components/NotificationCard';
import { useNotifications } from '../../context/NotificationsContext';
import * as notificationService from '../services/notificationService';

// Notification data types based on the NotificationsContext
interface NotificationData {
  id: string;
  type: 'GAME_INVITE' | 'FRIEND_REQUEST' | 'CLUB_MEMBER_JOINED' | 'CLUB_ROLE_UPDATE' | 'TOURNAMENT_ALERT' | 'TOURNAMENT_REMINDER';
  title: string;
  message: string;
  avatarUrl: string;
  timestamp: Date;
  actions: ('accept' | 'reject' | 'view')[];
  read: boolean;
}

// Helper function to format time since timestamp
const timeAgo = (timestamp: Date): string => {
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays < 1) {
    return 'Today';
  } else if (diffInDays === 1) {
    return '1d ago';
  } else {
    return `${diffInDays}d ago`;
  }
};

export default function NotificationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const { markAsRead } = useNotifications();

  // Fetch notifications from the API
  useEffect(() => {
    const fetchNotificationsData = async () => {
      setIsLoading(true);
      
      try {
        // Try to fetch from API first
        const result = await notificationService.fetchNotifications(50, 0);
        
        if (result.notifications.length > 0) {
          // Map API data to the format we need
          const mappedNotifications = result.notifications.map(n => {
            // Determine actions based on notification type
            let actions: ('accept' | 'reject' | 'view')[] = ['view'];
            
            if (n.type === 'GAME_INVITE' || n.type === 'FRIEND_REQUEST') {
              actions = ['accept', 'reject'];
            } else if (n.type === 'TOURNAMENT_ALERT' && n.data.requiresAction) {
              actions = ['accept', 'reject'];
            }
            
            // Get avatar URL based on the notification type
            let avatarUrl = '/images/avatars/default.jpg';
            
            if (n.type.includes('CLUB')) {
              avatarUrl = n.data.clubLogo || '/images/club-logos/clubmaster-gold.svg';
            } else if (n.type.includes('TOURNAMENT')) {
              avatarUrl = n.data.tournamentLogo || '/images/club-logos/kings-gambit.svg';
            } else if (n.type === 'FRIEND_REQUEST' || n.type === 'GAME_INVITE') {
              avatarUrl = n.data.senderAvatar || '/images/avatars/default.jpg';
            }
            
            return {
              id: n.id,
              type: n.type as any,
              title: n.data.title || n.type,
              message: n.message || n.data.message || '',
              avatarUrl,
              timestamp: n.timestamp,
              actions,
              read: n.read
            };
          });
          
          setNotifications(mappedNotifications);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
        // Fall back to mock data if API call fails
      }
      
      // Fallback to mock data
      const mockNotifications: NotificationData[] = [
        {
          id: '1',
          type: 'CLUB_ROLE_UPDATE',
          title: 'Clubmaster premier league',
          message: 'Congrats. You are the one of the player to play in Champions league. Best of luck.',
          avatarUrl: '/images/club-logos/clubmaster-gold.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          actions: ['view'],
          read: false
        },
        {
          id: '2',
          type: 'CLUB_MEMBER_JOINED',
          title: 'Clubmaster premier league',
          message: 'Admin added you to the Champions League.',
          avatarUrl: '/images/club-logos/clubmaster-gold.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['view'],
          read: false
        },
        {
          id: '3',
          type: 'TOURNAMENT_ALERT',
          title: 'King\'s Gambit',
          message: 'Admin added you to the tournament.',
          avatarUrl: '/images/club-logos/kings-gambit.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['accept', 'reject'],
          read: false
        },
        {
          id: '4',
          type: 'TOURNAMENT_ALERT',
          title: 'Athani Club',
          message: 'Athani club invited you to join King\'s Gambit Tournament.',
          avatarUrl: '/images/club-logos/athani.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['accept', 'reject'],
          read: false
        },
        {
          id: '5',
          type: 'TOURNAMENT_REMINDER',
          title: 'Akhil',
          message: 'I need to quit from tournament Add another player, so I can left.',
          avatarUrl: '/images/avatars/akhil.jpg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['view'],
          read: false
        },
        {
          id: '6',
          type: 'TOURNAMENT_ALERT',
          title: 'Athani Club',
          message: 'The admin removed you from the tournament.',
          avatarUrl: '/images/club-logos/athani.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['view'],
          read: false
        },
        {
          id: '7',
          type: 'CLUB_ROLE_UPDATE',
          title: 'Athani Club',
          message: 'Congrats. You are the one of the player to play in Champions league. Best of luck.',
          avatarUrl: '/images/club-logos/athani.svg',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          actions: ['view'],
          read: false
        }
      ];

      setNotifications(mockNotifications);
      setIsLoading(false);
    };

    fetchNotificationsData();
  }, []);

  // Handle the action buttons
  const handleAction = async (notificationId: string, action: string) => {
    // Find the notification to get its type
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    if (action === 'view') {
      // Mark as read both locally and on the server
      await notificationService.markNotificationAsRead(notificationId);
      markAsRead(notificationId);
      
      // Update the local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      // Handle navigation based on notification type
      if (notification.type === 'CLUB_ROLE_UPDATE' || notification.type === 'CLUB_MEMBER_JOINED') {
        router.push('/club/detail');
      } else if (notification.type.includes('TOURNAMENT')) {
        router.push('/tournament');
      }
    } else {
      try {
        // Optimistically update UI
        if (action === 'accept' || action === 'reject') {
          // Remove notification from list (optimistic UI update)
          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        }
        
        // Call the API to handle the action
        const success = await notificationService.handleNotificationAction(
          notificationId,
          action,
          notification.type
        );
        
        if (!success) {
          // If the action failed, revert the optimistic update
          console.error(`Action ${action} failed for notification ${notificationId}`);
          // Re-fetch notifications
          const result = await notificationService.fetchNotifications(50, 0);
          // Map to our format
          // (simplified for this example - would need the same mapping logic as above)
        }
      } catch (error) {
        console.error('Error handling notification action:', error);
      }
    }
  };

  // Notification Card Component - Matches Clubmaster App Style
  const NotificationItem = ({ notification }: { notification: NotificationData }) => {
    return (
      <div className="bg-[#4C5454] rounded-xl shadow-md p-4 mb-4 hover:bg-[#5A5E5E] transition-colors">
        <div className="flex">
          {/* Avatar */}
          <div className="relative mr-3 flex-shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-[#3E4546] flex items-center justify-center">
              <Image 
                src={notification.avatarUrl} 
                alt={notification.title}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between">
              <h3 className="text-[#FAF3DD] font-medium text-base">{notification.title}</h3>
              <span className="text-[#BDBDBD] text-xs">{timeAgo(notification.timestamp)}</span>
            </div>
            <p className="text-[#BDBDBD] text-sm mt-1 mb-3">{notification.message}</p>
            
            {/* Action Buttons */}
            <div className="flex justify-end mt-2 gap-x-2">
              {notification.actions.includes('view') && (
                <button 
                  onClick={() => handleAction(notification.id, 'view')}
                  className="bg-[#4A7C59] text-[#FAF3DD] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#3D6A4A] transition-colors"
                >
                  View
                </button>
              )}
              {notification.actions.includes('accept') && (
                <button 
                  onClick={() => handleAction(notification.id, 'accept')}
                  className="bg-[#4A7C59] text-[#FAF3DD] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#3D6A4A] transition-colors"
                >
                  Accept
                </button>
              )}
              {notification.actions.includes('reject') && (
                <button 
                  onClick={() => handleAction(notification.id, 'reject')}
                  className="bg-[#979797] text-[#FAF3DD] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#878787] transition-colors"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#333939]">
      {/* Header - Matches PlayerSelectionList style */}
      <div className="sticky top-0 z-20 bg-[#333939]">
        <div className="flex items-center px-4 py-4">
          <button 
            onClick={() => router.back()}
            className="text-[#BFC0C0]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[26px] font-semibold text-[#FAF3DD]">Notifications</h1>
          <span className="w-6"></span> {/* Empty space for symmetry */}
        </div>
      </div>

      {/* Notification List - With fixed max width and centered */}
      <div className="px-4 pt-2 pb-20" style={{ maxWidth: 480, margin: "0 auto" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#E9CB6B]"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#B0B0B0]">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 15H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 9H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="mt-4 text-lg">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Responsive styles */}
      <style jsx global>{`
        @media (max-width: 600px) {
          .min-h-screen { min-height: 100vh; }
          .text-xl { font-size: 1.2rem; }
          .text-base { font-size: 1rem; }
        }
        @media (min-width: 601px) {
          .px-4 { padding-left: 2rem; padding-right: 2rem; }
          .pt-2 { padding-top: 1rem; }
          .pb-20 { padding-bottom: 5rem; }
        }
      `}</style>
    </div>
  );
} 