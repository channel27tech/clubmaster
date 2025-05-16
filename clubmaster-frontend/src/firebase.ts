import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator, setPersistence, browserLocalPersistence } from "firebase/auth";

// Store the Firebase app instance globally for reuse
let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;

// Initialize Firebase safely
const initializeFirebase = (): FirebaseApp => {
  if (firebaseApp) return firebaseApp; // Return existing instance if already initialized

  try {
    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAhDV2IA12zNloXDOsfTBoqy89Mzht5LC4",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "clubmaster-chess.firebaseapp.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "clubmaster-chess",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "clubmaster-chess.firebasestorage.app",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "442785119596",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:442785119596:web:997924be529f49ba5cc749"
    };

    // Initialize Firebase only on client side
    if (typeof window !== 'undefined') {
      console.log("Initializing Firebase...");
      
      // Set up any required Firebase options
      if (!firebaseApp) {
        // Set CORS headers (for local development)
        if (process.env.NODE_ENV === 'development') {
          console.log("Setting up for local development");
        }
        
        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully");
      }
      
      // Initialize Auth
      authInstance = getAuth(firebaseApp);
      
      // Configure persistence to local storage (helps with page refreshes)
      setPersistence(authInstance, browserLocalPersistence)
        .then(() => {
          console.log("Firebase persistence set to local");
        })
        .catch((error) => {
          console.error("Error setting persistence:", error);
        });
      
      // Connect to Auth Emulator if in development
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
        connectAuthEmulator(authInstance, 'http://localhost:9099');
        console.log("Connected to Firebase Auth Emulator");
      }
    } else {
      // For SSR, create a temporary app instance
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    return firebaseApp;
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
};

// Initialize Firebase on import
const app = initializeFirebase();

// Get auth instance - use getAuth with the app if authInstance is null
export const auth = authInstance || getAuth(app);

// Export the app instance for other Firebase services if needed
export default app; 