import { User } from 'firebase/auth';

// Define user interface for our app
export interface AppUser {
  id: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  isActive: boolean;
  lastActive?: string;
  rating?: number;
  isAnonymous?: boolean;
  uid?: string;
  username?: string;
  firebaseUid?: string;
  custom_photo_base64?: string;
  effective_photo_url?: string;
}

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Mock data for development and fallback
const mockUsers: AppUser[] = [
  { id: "user1", displayName: "QueenKnight_22", isActive: true, rating: 1245 },
  { id: "user2", displayName: "ChessMaster42", isActive: true, rating: 1876 },
  { id: "user3", displayName: "KingSlayer", isActive: true, rating: 1645 },
  { id: "user4", displayName: "PawnStars", isActive: true, rating: 1345 },
  { id: "user5", displayName: "CheckMatePro", isActive: false, lastActive: "5 hrs ago", rating: 1890 },
  { id: "user6", displayName: "RookieMove", isActive: false, lastActive: "10 hrs ago", rating: 897 },
  { id: "user7", displayName: "BishopRunner", isActive: false, lastActive: "11 hrs ago", rating: 1567 },
  { id: "user8", displayName: "KnightRider", isActive: false, lastActive: "15 hrs ago", rating: 1234 },
  { id: "user9", displayName: "CastleMaster", isActive: false, lastActive: "1 Day ago", rating: 1432 },
];

/**
 * Fetch all users except the current user
 * @param currentUser The currently logged in user
 * @returns A list of users excluding the current user
 */
export const fetchUsers = async (currentUser: User | null): Promise<AppUser[]> => {
  try {
    if (!currentUser) {
      throw new Error('User must be authenticated to fetch users');
    }

    try {
      // Get the Firebase ID token
      const token = await currentUser.getIdToken();

      // Make the API call
      const response = await fetch(`${API_URL}/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const users: AppUser[] = await response.json();

      // Filter out the current user and guest users, then map to AppUser format
      const filteredUsers = users
        .filter((user: AppUser) => {
          // Filter out the current user and guest users
          return user.id !== currentUser.uid && 
                 user.email !== currentUser.email && 
                 !user.isAnonymous; // Filter out guest users
        })
        // Map users to AppUser format with basic info
        .map((user: AppUser) => ({
          // Use firebaseUid as the id for consistency with activity context
          id: user.firebaseUid || user.id, // Use firebaseUid if available, otherwise fallback to db id
          displayName: user.displayName || user.username || 'Anonymous',
          email: user.email,
          photoURL: user.photoURL,
          isActive: false, // Initialize isActive to false; real status comes from ActivityContext
          rating: user.rating || Math.floor(Math.random() * 1000) + 500, // Use rating from backend or generate one
          isAnonymous: user.isAnonymous,
          uid: user.uid, // Keep original uid if needed elsewhere
          username: user.username,
          custom_photo_base64: user.custom_photo_base64,
          effective_photo_url: user.effective_photo_url
        }));
      
      return filteredUsers;
    } catch (apiError) {
      console.error('API Error:', apiError);
      console.warn('Falling back to mock user data');
      
      // Return filtered mock data if the API call fails
      // Note: Mock data filtering should still exclude current/guest users
      return filterMockUsers(currentUser);
    }
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    
    // If user is not authenticated, return an empty array
    return [];
  }
};

/**
 * Filter mock users to exclude the current user and guests, and add lastActive for inactive mocks.
 * This provides consistent behavior between real and mock data.
 */
function filterMockUsers(currentUser: User): AppUser[] {
  // Filter out current user and guest users
  return mockUsers
    .filter(mockUser => {
      // Compare both email and possible ID formats to ensure we exclude the current user
      return mockUser.id !== currentUser.uid && 
             mockUser.email !== currentUser.email &&
             !mockUser.isAnonymous &&
             mockUser.id !== currentUser.uid.substring(0, 6); // In case mockUser.id is a shortened version
    })
    // Add proper last active time for consistency for inactive users in mock data
    .map(user => ({
      ...user,
      // For inactive users, ensure there's a lastActive value if it doesn't exist
      lastActive: !user.isActive && !user.lastActive ? getRandomLastActive() : user.lastActive
    }));
}

// Helper function to generate random last active time for demo purposes
// In a real app, this would come from the backend
function getRandomLastActive(): string {
  const options = ['1 hr ago', '2 hrs ago', '5 hrs ago', 'Today', 'Yesterday', '2 days ago'];
  return options[Math.floor(Math.random() * options.length)];
} 