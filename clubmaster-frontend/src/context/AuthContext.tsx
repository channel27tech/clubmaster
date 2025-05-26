'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  UserCredential,
  FacebookAuthProvider, 
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  ConfirmationResult, 
  signInWithPopup,
  signInWithPhoneNumber,
  signOut,
  signInAnonymously,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Define types for the context
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  loginWithGoogle: () => Promise<UserCredential>;
  loginWithFacebook: () => Promise<UserCredential>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<UserCredential>;
  continueAsGuest: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  error: string | null;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Derived state to identify guest users
  const isGuest = user?.isAnonymous === true;
  
  // Function to sync Firebase user with backend
  const syncUserWithBackend = async (firebaseUser: User) => {
    try {
      // Get Firebase ID token
      const token = await firebaseUser.getIdToken();
      
      // Prepare user data payload
      const payload = {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        phoneNumber: firebaseUser.phoneNumber,
        isAnonymous: firebaseUser.isAnonymous,
      };
      
      // Log sync attempt
      console.log('🔄 Syncing user data with backend:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName
      });
      console.log('🔑 Token available:', !!token);
      
      // Check if backend is available
      try {
        // Send to backend with a timeout of 5 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_URL}/users/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Backend sync response not OK: ${response.status} ${response.statusText}. Details: ${errorText}`);
          return; // Continue without blocking auth flow
        }
        
        const data = await response.json();
        console.log('✅ User data synced successfully:', data);
      } catch (fetchError: unknown) {
        // Handle network errors or timeout
        console.warn('⚠️ Backend sync network error (continuing with auth flow):', 
          fetchError instanceof Error ? fetchError.message : String(fetchError));
        // Still allow the user to proceed with authentication
        // This prevents the backend being down from blocking the entire auth flow
      }
    } catch (error) {
      console.error('❌ Error syncing user data with backend:', error);
      // We don't set error state here to avoid blocking the login flow
      // But we log it for debugging
    }
  };
  
  // Set up auth state listener on component mount
  useEffect(() => {
    // Only run in browser
    if (typeof window !== 'undefined') {
      console.log("Setting up auth state listener");
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log("Auth state changed:", firebaseUser ? "User logged in" : "No user");
        
        if (firebaseUser) {
          console.log("User details:", {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            isAnonymous: firebaseUser.isAnonymous,
            emailVerified: firebaseUser.emailVerified,
            providerId: firebaseUser.providerId,
          });
          
          // Sync user data with backend
          await syncUserWithBackend(firebaseUser);
        }
        
        setUser(firebaseUser);
        setIsLoading(false);
      }, (error) => {
        console.error("Auth state change error:", error);
        setError("Authentication state monitoring failed");
        setIsLoading(false);
      });
      
      // Clean up subscription on unmount
      return () => unsubscribe();
    }
  }, []);
  
  // Google login
  const loginWithGoogle = async (): Promise<UserCredential> => {
    setError(null);
    try {
      console.log("Attempting Google login");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      console.log("Google login successful, user:", result.user.email);
      
      // Explicitly sync with backend right after login
      await syncUserWithBackend(result.user);
      
      // Explicitly update the user state (though the onAuthStateChanged should catch this too)
      setUser(result.user);
      
      return result;
    } catch (error: any) {
      console.error("Google login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        setError("Login cancelled. Please try again.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("Popup blocked. Please allow popups for this website and try again.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Network error. Please check your internet connection and try again.");
      } else if (error.code === 'auth/internal-error') {
        setError("Internal authentication error. Please try again later.");
      } else {
        setError(`Failed to login with Google: ${error.message}`);
      }
      throw error;
    }
  };
  
  // Facebook login
  const loginWithFacebook = async (): Promise<UserCredential> => {
    setError(null);
    try {
      console.log("Attempting Facebook login");
      const provider = new FacebookAuthProvider();
      provider.setCustomParameters({
        display: 'popup'
      });
      const result = await signInWithPopup(auth, provider);
      console.log("Facebook login successful, user:", result.user.email);
      
      // Explicitly sync with backend right after login
      await syncUserWithBackend(result.user);
      
      // Explicitly update the user state (though the onAuthStateChanged should catch this too)
      setUser(result.user);
      
      return result;
    } catch (error: any) {
      console.error("Facebook login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Handle specific error cases
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with the same email address but different login credentials.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError("Login cancelled. Please try again.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("Popup blocked. Please allow popups for this website and try again.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Network error. Please check your internet connection and try again.");
      } else if (error.code === 'auth/internal-error') {
        setError("Internal authentication error. Please try again later.");
      } else {
        setError(`Failed to login with Facebook: ${error.message}`);
      }
      throw error;
    }
  };
  
  // Phone login - step 1: send OTP
  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    setError(null);
    try {
      // Create an invisible reCAPTCHA
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          console.log("reCAPTCHA verified");
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          setError("reCAPTCHA expired. Please try again.");
        }
      });
      
      // Format phone number if necessary (add country code if missing)
      const formattedPhoneNumber = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+${phoneNumber}`;
        
      // Send verification code
      const confirmationResult = await signInWithPhoneNumber(
        auth, 
        formattedPhoneNumber, 
        recaptchaVerifier
      );
      
      return confirmationResult;
    } catch (error: any) {
      console.error("Phone login error:", error);
      // Handle specific error cases
      if (error.code === 'auth/invalid-phone-number') {
        setError("The phone number is not valid. Please check and try again.");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Too many login attempts. Please try again later.");
      } else if (error.code === 'auth/captcha-check-failed') {
        setError("reCAPTCHA verification failed. Please try again.");
      } else {
        setError("Failed to send verification code. Please try again.");
      }
      throw error;
    }
  };
  
  // Phone login - step 2: verify OTP
  const verifyOTP = async (
    confirmationResult: ConfirmationResult, 
    otp: string
  ): Promise<UserCredential> => {
    setError(null);
    try {
      const result = await confirmationResult.confirm(otp);
      console.log("Phone login successful, user:", result.user.phoneNumber);
      
      // Explicitly sync with backend right after login
      await syncUserWithBackend(result.user);
      
      // Explicitly update the user state
      setUser(result.user);
      
      return result;
    } catch (error: any) {
      console.error("OTP verification error:", error);
      // Handle specific error cases
      if (error.code === 'auth/invalid-verification-code') {
        setError("Invalid verification code. Please check and try again.");
      } else if (error.code === 'auth/code-expired') {
        setError("Verification code has expired. Please request a new one.");
      } else {
        setError("Failed to verify code. Please try again.");
      }
      throw error;
    }
  };
  
  // Guest login
  const continueAsGuest = async (): Promise<UserCredential> => {
    setError(null);
    try {
      const result = await signInAnonymously(auth);
      console.log("Guest login successful, anonymous user created");
      
      // Generate a random guest name
      if (result.user) {
        const guestName = "ChessGuest#" + Math.floor(Math.random() * 10000);
        
        // Update the user profile with the guest name
        try {
          // This will make the guest name visible in the app, but it's not required
          await updateProfile(result.user, {
            displayName: guestName
          });
          
          console.log("Guest display name set:", guestName);
          
          // Force refresh the user to get the updated display name
          // This triggers the onAuthStateChanged event
          setUser({...result.user});
        } catch (profileError) {
          console.error("Failed to set guest display name:", profileError);
          // Continue anyway, as this is not critical
        }
      }
      
      // Sync user data with backend
      await syncUserWithBackend(result.user);
      
      return result;
    } catch (error: any) {
      console.error("Guest login error:", error);
      setError("Failed to continue as guest. Please try again.");
      throw error;
    }
  };
  
  // Logout
  const logout = async (): Promise<void> => {
    setError(null);
    try {
      await signOut(auth);
      console.log("User logged out successfully");
      
      // Explicitly set user to null
      setUser(null);
    } catch (error: any) {
      console.error("Logout error:", error);
      setError("Failed to log out. Please try again.");
      throw error;
    }
  };
  
  // Provide the auth context value
  const value: AuthContextType = {
    user,
    isLoading,
    isGuest,
    loginWithGoogle,
    loginWithFacebook,
    loginWithPhone,
    verifyOTP,
    continueAsGuest,
    logout,
    error
  };
  
  useEffect(() => {
    if (user) {
      user.getIdToken().then(async (token) => {
        try {
          await axios.post(
            `${API_URL}/users/sync`,
            {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              phoneNumber: user.phoneNumber,
              isAnonymous: user.isAnonymous,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          // No setIsAuthenticated needed
        } catch (err) {
          // If sync fails, log out and show error
          logout();
          alert('Authentication failed. Please try again.');
        }
      });
    }
  }, [user]);
  
  return (
    <AuthContext.Provider value={value}>
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Return stub implementation for SSR
    return {
      user: null,
      isLoading: true,
      isGuest: false,
      loginWithGoogle: async () => { throw new Error('Auth not available during SSR'); },
      loginWithFacebook: async () => { throw new Error('Auth not available during SSR'); },
      loginWithPhone: async () => { throw new Error('Auth not available during SSR'); },
      verifyOTP: async () => { throw new Error('Auth not available during SSR'); },
      continueAsGuest: async () => { throw new Error('Auth not available during SSR'); },
      logout: async () => { throw new Error('Auth not available during SSR'); },
      error: null
    };
  }

  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 