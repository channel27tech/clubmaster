'use client';

import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationsContext';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const { notifications, totalUnread, markAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const toggleNotifications = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleClearNotification = (id: string) => {
    deleteNotification(id);
  };

  const handleViewAll = () => {
    router.push('/notifications');
    setIsOpen(false);
  };

  // Format timestamp to a readable format
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Default: show date
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button 
        className={`relative p-2 rounded-full hover:bg-[#3E4546] ${className}`}
        onClick={toggleNotifications}
        aria-label="Notifications"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6 text-[#FAF3DD]" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-[#333939] transform translate-x-1/2 -translate-y-1/2 bg-[#E9CB6B] rounded-full">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#4C5454] rounded-md shadow-lg overflow-hidden z-20">
          <div className="py-2">
            <div className="px-4 py-2 border-b border-[#333939] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[#FAF3DD]">Notifications</h3>
              <div className="flex space-x-2">
                {notifications.length > 0 && (
                  <button 
                    className="text-sm text-[#E9CB6B] hover:text-[#E0BF56]"
                    onClick={handleViewAll}
                  >
                    View All
                  </button>
                )}
                <button 
                  className="text-sm text-[#BFC0C0] hover:text-[#FAF3DD]"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-[#BFC0C0]">
                No notifications
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {notifications.slice(0, 5).map((notification) => (
                  <div 
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-[#3E4546] border-b border-[#333939] ${!notification.read ? 'bg-[#3E4546]' : ''}`}
                  >
                    <div className="flex justify-between">
                      <p className="font-medium text-sm text-[#FAF3DD]">{notification.message}</p>
                      <button 
                        onClick={() => handleClearNotification(notification.id)}
                        className="text-[#BFC0C0] hover:text-[#FAF3DD]"
                        aria-label="Dismiss notification"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-[#BFC0C0] mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="mt-2 text-xs text-[#E9CB6B] hover:text-[#E0BF56]"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))}
                {notifications.length > 5 && (
                  <div className="px-4 py-2 text-center">
                    <button 
                      className="text-sm text-[#E9CB6B] hover:text-[#E0BF56]"
                      onClick={handleViewAll}
                    >
                      View all {notifications.length} notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 