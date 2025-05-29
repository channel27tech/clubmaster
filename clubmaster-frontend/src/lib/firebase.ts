// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Replace these with your actual Firebase project configuration!
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID" // Optional: for Google Analytics
};

// Initialize Firebase - only initialize once to avoid duplicate initialization errors
let firebaseApp: FirebaseApp | undefined;

// Check if we're in a browser environment to avoid SSR issues
if (typeof window !== 'undefined') {
  // Only initialize if no Firebase apps are already initialized
  if (!getApps().length) {
    console.log("Initializing Firebase app");
    firebaseApp = initializeApp(firebaseConfig);
    
    // Initialize Analytics if possible (client-side only)
    isSupported().then(supported => {
      if (supported) {
        getAnalytics(firebaseApp as FirebaseApp);
      }
    });
  } else {
    console.log("Firebase already initialized, reusing existing app");
    firebaseApp = getApp();
  }
} else {
  console.log("Skipping Firebase initialization in server environment");
}

// Auth singleton
export const auth = typeof window !== 'undefined' ? getAuth() : null;

export default firebaseApp; 