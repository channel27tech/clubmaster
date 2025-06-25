import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Cookies from 'js-cookie';

/**
 * AuthTokenManager component
 * 
 * This component manages the auth token lifecycle:
 * 1. When a user logs in, it stores their Firebase ID token in a cookie
 * 2. It refreshes the token periodically to prevent expiration
 * 3. It removes the token when the user logs out
 * 
 * Place this component near the root of your app (in _app.tsx or layout.tsx)
 */
const AuthTokenManager: React.FC = () => {
  const { user, isLoading, isGuest } = useAuth();

  useEffect(() => {
    const persistToken = async () => {
      try {
        if (user) {
          console.log('Persisting auth token for user:', user.uid);
          
          // Handle guest users differently
          if (isGuest) {
            // For guest users, we create a special guest token
            const guestToken = `guest_${user.uid}`;
            
            // Store in cookie
            Cookies.set('authToken', guestToken, { 
              expires: 1, // 1 day for guest users
              path: '/',
              sameSite: 'strict'
            });
            
            console.log('Guest token stored in cookie');
          } else {
            // For regular users, get fresh token
            const token = await user.getIdToken(true);
            
            // Store in cookie (secure, http-only would be better but requires server-side code)
            Cookies.set('authToken', token, { 
              expires: 7, // 7 days
              path: '/',
              sameSite: 'strict'
            });
            
            console.log('Auth token successfully stored in cookie');
          }
        } else if (!isLoading) {
          // If user is logged out and not in loading state, clear the cookie
          console.log('No user logged in, removing auth token cookie');
          Cookies.remove('authToken', { path: '/' });
        }
      } catch (error) {
        console.error('Error persisting auth token:', error);
      }
    };

    // Initial token persistence
    persistToken();

    // Set up refresh interval (every 30 minutes)
    const tokenRefreshInterval = setInterval(persistToken, 30 * 60 * 1000);

    // Clean up on unmount
    return () => {
      clearInterval(tokenRefreshInterval);
    };
  }, [user, isLoading, isGuest]);

  // This is a utility component that doesn't render anything
  return null;
};

export default AuthTokenManager; 