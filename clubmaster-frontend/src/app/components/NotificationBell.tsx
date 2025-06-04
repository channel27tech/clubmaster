'use client';

import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const { notifications, unreadCount, markAsRead, clearNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const toggleNotifications = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleClearNotification = (id: string) => {
    clearNotification(id);
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
        className={`relative p-2 rounded-full hover:bg-gray-200 ${className}`}
        onClick={toggleNotifications}
        aria-label="Notifications"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6" 
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
        
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20">
          <div className="py-2">
            <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Notifications</h3>
              {notifications.length > 0 && (
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </button>
              )}
            </div>
            
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${!notification.read ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex justify-between">
                      <p className="font-medium text-sm">{notification.message}</p>
                      <button 
                        onClick={() => handleClearNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Dismiss notification"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 