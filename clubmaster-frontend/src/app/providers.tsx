'use client';

import React, { useState, useEffect } from 'react';
import { SocketProvider } from '../contexts/SocketContext';
import { SoundProvider } from '../contexts/SoundContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  // Get or generate a userId for the current user
  const [userId, setUserId] = useState<string>('');
  
  useEffect(() => {
    // In a real app, you'd get this from auth
    // For now, we'll use a saved ID or generate a new one
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem('userId');
      if (!id) {
        // Generate a simple ID for demo purposes
        id = 'user_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('userId', id);
      }
      setUserId(id);
    }
  }, []);
  
  // Only render providers when userId is available
  if (!userId) {
    return <div>Loading...</div>;
  }
  
  return (
    <SocketProvider>
      <SoundProvider userId={userId}>
      {children}
      </SoundProvider>
    </SocketProvider>
  );
}; 