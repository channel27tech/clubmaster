import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAhDV2IA12zNloXDOsfTBoqy89Mzht5LC4",
  authDomain: "clubmaster-chess.firebaseapp.com",
  projectId: "clubmaster-chess",
  storageBucket: "clubmaster-chess.firebasestorage.app",
  messagingSenderId: "442785119596",
  appId: "1:442785119596:web:997924be529f49ba5cc749"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Export the app instance for other Firebase services if needed
export default app; 