'use client';

import React from 'react';
import Image from 'next/image';

export interface NotificationCardProps {
  id: string;
  title: string;
  message: string;
  avatarUrl: string;
  timestamp: Date;
  actions: ('accept' | 'reject' | 'view')[];
  onAction: (id: string, action: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  id,
  title,
  message,
  avatarUrl,
  timestamp,
  actions,
  onAction
}) => {
  // Format the time as "Xd ago"
  const formatTime = (timestamp: Date) => {
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

  return (
    <div className="bg-[#4C5454] rounded-xl shadow-md p-4 mb-4 hover:bg-[#5A5E5E] transition-colors">
      <div className="flex">
        {/* Avatar */}
        <div className="relative mr-3 flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#3E4546] flex items-center justify-center">
            <img 
              src={avatarUrl} 
              alt={title}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              style={{ borderRadius: '50%' }}
            />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <h3 className="text-[#FAF3DD] font-medium text-base">{title}</h3>
            <span className="text-[#BDBDBD] text-xs">{formatTime(timestamp)}</span>
          </div>
          <p className="text-[#BDBDBD] text-sm mt-1 mb-3">{message}</p>
          
          {/* Action Buttons */}
          <div className="flex justify-end mt-2 gap-x-2">
            {actions.includes('view') && (
              <button 
                onClick={() => onAction(id, 'view')}
                className="bg-[#4A7C59] text-[#FAF3DD] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#3D6A4A] transition-colors"
              >
                View
              </button>
            )}
            {actions.includes('accept') && (
              <button 
                onClick={() => onAction(id, 'accept')}
                className="bg-[#4A7C59] text-[#FAF3DD] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#3D6A4A] transition-colors"
              >
                Accept
              </button>
            )}
            {actions.includes('reject') && (
              <button 
                onClick={() => onAction(id, 'reject')}
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

export default NotificationCard; 