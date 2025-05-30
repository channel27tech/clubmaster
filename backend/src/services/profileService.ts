import { Pool } from 'pg';

// Initialize a connection pool. Configure with your actual database details.
// It's good practice to use environment variables for this.
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'clubmaster',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Define the UserProfileUpdateData interface
export interface UserProfileUpdateData {
  firebase_uid: string;
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  location?: string | null;
  custom_photo_base64?: string | null;
}

// Check if a username is available
export const checkUsernameAvailability = async (username: string, currentUserId?: string): Promise<boolean> => {
  try {
    let query = 'SELECT id FROM users WHERE username = $1';
    const params: any[] = [username];

    if (currentUserId) {
      query += ' AND firebase_uid != $2';
      params.push(currentUserId);
    }

    const result = await pool.query(query, params);
    return result.rows.length === 0;
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw new Error('Database error while checking username.');
  }
};

// Update a user's profile
export const updateUserProfile = async (data: UserProfileUpdateData): Promise<any> => {
  const { firebase_uid, username, first_name, last_name, location, custom_photo_base64 } = data;

  // Check if username is provided and if it's available (if it's different from the current one)
  if (username) {
    const isUsernameAvailable = await checkUsernameAvailability(username, firebase_uid);
    if (!isUsernameAvailable) {
      throw new Error('Username is already taken.');
    }
  }

  // Check if custom photo is provided and if it's a valid base64 image

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (username !== undefined) { updates.push(`username = $${paramIndex++}`); values.push(username); }
  // For nullable fields, explicitly set to NULL if an empty string or null is passed
  if (first_name !== undefined) { updates.push(`first_name = $${paramIndex++}`); values.push(first_name); }
  if (last_name !== undefined) { updates.push(`last_name = $${paramIndex++}`); values.push(last_name); }
  if (location !== undefined) { updates.push(`location = $${paramIndex++}`); values.push(location); }
  if (custom_photo_base64 !== undefined) { updates.push(`custom_photo_base64 = $${paramIndex++}`); values.push(custom_photo_base64); }

  if (updates.length === 0) {
    // No actual fields to update, but we might still want to return the user data
    // or handle as a "no change" scenario.
    const currentUser = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [firebase_uid]);
    if (currentUser.rows.length === 0) {
        throw new Error('User not found.');
    }
    return currentUser.rows[0];
  }

  updates.push(`updated_at = NOW()`);
  
  // Check if custom photo is provided and if it's a valid base64 image

  const query = `UPDATE users SET ${updates.join(', ')} WHERE firebase_uid = $${paramIndex} RETURNING *`;
  values.push(firebase_uid);
  

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('User not found or update failed.');
    }
    return result.rows[0]; // Return the updated user profile
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error instanceof Error && error.message.includes('unique_username')) {
        throw new Error('Username is already taken.');
    }
    throw new Error('Database error during profile update.');
  }
};

// Get a user's profile by their Firebase UID

export const getUserProfileByFirebaseUID = async (firebase_uid: string): Promise<any> => {
    try {
        const result = await pool.query('SELECT *, COALESCE(custom_photo_base64, photo_url) as effective_photo_url FROM users WHERE firebase_uid = $1', [firebase_uid]);
        if (result.rows.length === 0) {
            return null; // Or throw an error, depending on how you want to handle not found
        }
        const user = result.rows[0];
        // Ensure username is populated, defaulting to display_name if somehow null after migration
        if (!user.username && user.display_name) {
            user.username = user.display_name;
        }
        return user;
    } catch (error) {
        console.error('Error fetching user profile by Firebase UID:', error);
        throw new Error('Database error while fetching user profile.');
    }
}; 