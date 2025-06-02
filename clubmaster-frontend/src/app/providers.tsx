'use client';

import React, { useState, useEffect } from 'react';
import { SocketProvider } from '../context/SocketContext';
import { SoundProvider } from '../context/SoundContext';
import { AuthProvider } from '../context/AuthContext';
import { BetProvider } from '../context/BetContext';
import { ActivityProvider } from '../context/ActivityContext';
import RouteGuard from '../components/RouteGuard';
import GlobalNotifications from './components/GlobalNotifications';

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  // Get or generate a userId for the current user - used only for sound settings
  // Firebase auth will handle the actual user authentication
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // This is just for local storage of sound preferences
    // Not related to the actual user authentication
    if (typeof window !== 'undefined') {
      console.log("Providers initializing...");
      
      // Attempt to initialize any browser APIs needed
      try {
        // Check for any blocked features
        const checkPermissions = async () => {
          try {
            // Check if cookies are enabled
            if (!navigator.cookieEnabled) {
              console.warn("Cookies are disabled - this may affect authentication");
            }
            
            // Check if localStorage is available
            if (typeof localStorage === 'undefined') {
              console.warn("LocalStorage is not available - this may affect persistence");
            } else {
              // Test localStorage access
              localStorage.setItem('_test', '1');
              localStorage.removeItem('_test');
            }
          } catch (e) {
            console.error("Error checking browser features:", e);
          }
        };
        
        checkPermissions();
      } catch (e) {
        console.error("Error in provider initialization:", e);
      }
      
      // Set up sound preferences ID
      let id = localStorage.getItem('soundPrefsId');
      if (!id) {
        // Generate a simple ID for sound preferences only
        id = 'sound_prefs_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('soundPrefsId', id);
      }
      setUserId(id);
      setIsLoading(false);
      
      console.log("Providers initialized successfully");
    }
  }, []);
  
  // Show a loading state while the user ID is being retrieved
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#333939" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E9CB6B]"></div>
      </div>
    );
  }
  
  return (
    <AuthProvider>
      <RouteGuard>
        <SocketProvider>
          <ActivityProvider>
          <SoundProvider userId={userId}>
              <BetProvider>
                {children}
                <GlobalNotifications />
              </BetProvider>
          </SoundProvider>
          </ActivityProvider>
        </SocketProvider>
      </RouteGuard>
    </AuthProvider>
  );
}; 