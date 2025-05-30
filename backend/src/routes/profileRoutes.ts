import express, { Request, Response, Router, NextFunction } from 'express';
import admin from '../config/firebaseAdmin'; // Your Firebase Admin SDK initialization
import {
  updateUserProfile,
  UserProfileUpdateData,
  checkUsernameAvailability, // Import if you want a separate endpoint for this
  getUserProfileByFirebaseUID
} from '../services/profileService';
// Assuming imageProcessor.ts is not directly used here if base64 is sent from frontend
// If backend needs to process a file, you'd use multer and imageProcessor here.

const router: Router = express.Router();

// Middleware to verify Firebase ID token
const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    res.status(401).send('Unauthorized: No token provided.');
    return;
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken; // Add Firebase user to request object
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(403).send('Unauthorized: Invalid token.');
    return;
  }
};

// POST /api/profile/update
router.post('/update', verifyToken, async (req: Request, res: Response): Promise<void> => {
  const firebase_uid = (req as any).user.uid;
  const { username, first_name, last_name, location, custom_photo_base64 } = req.body;

  if (!firebase_uid) {
    res.status(400).json({ message: 'User UID not found in token.' });
    return;
  }

  // Basic validation for username if provided
  if (username !== undefined && (typeof username !== 'string' || username.trim() === '')) {
    res.status(400).json({ message: 'Username must be a non-empty string.' });
    return;
  }
  // Add more specific validations for other fields as needed

  const updateData: UserProfileUpdateData = {
    firebase_uid,
    // Only include fields if they are actually provided in the request body
    ...(username !== undefined && { username }),
    ...(first_name !== undefined && { first_name: first_name || null }),
    ...(last_name !== undefined && { last_name: last_name || null }),
    ...(location !== undefined && { location: location || null }),
    ...(custom_photo_base64 !== undefined && { custom_photo_base64: custom_photo_base64 || null }),
  };

  try {
    // If username is being updated, check availability first (profileService also does this)
    if (username !== undefined) {
      // Get current user's username to see if it's actually changing
      const currentUserProfile = await getUserProfileByFirebaseUID(firebase_uid);
      if (currentUserProfile && currentUserProfile.username !== username) {
        const isAvailable = await checkUsernameAvailability(username, firebase_uid);
        if (!isAvailable) {
          res.status(409).json({ message: 'Username is already taken.' });
          return;
        }
      }
    }
    
    

    const updatedProfile = await updateUserProfile(updateData);
    res.status(200).json({ message: 'Profile updated successfully.', user: updatedProfile });
  } catch (error) {
    console.error('Error in /api/profile/update:', error);
    if (error instanceof Error) {
      if (error.message === 'Username is already taken.') {
        res.status(409).json({ message: error.message }); // 409 Conflict
        return;
      }
      if (error.message.includes('User not found')){
        res.status(404).json({ message: error.message });
        return;
      }
    }
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// GET /api/profile (example, if you need a dedicated endpoint to fetch profile)
// Your existing profile fetching logic might already handle this.
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    const firebase_uid = (req as any).user.uid;
    if (!firebase_uid) {
        res.status(400).json({ message: 'User UID not found in token.' });
        return;
    }
    try {
        const userProfile = await getUserProfileByFirebaseUID(firebase_uid);
        if (!userProfile) {
            res.status(404).json({ message: 'Profile not found.'});
            return;
        }
        res.status(200).json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Failed to fetch profile.' });
    }
});

export default router; 