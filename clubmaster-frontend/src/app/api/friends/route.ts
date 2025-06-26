import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Debug function to help trace authentication issues
const debugAuth = (req: NextRequest) => {
  const authToken = req.cookies.get('authToken')?.value;
  console.log('API Route Debug - /api/friends:');
  console.log('Auth Token exists:', !!authToken);
  if (authToken) {
    // Log first few characters of token for debugging (never log full token in production)
    console.log('Auth Token preview:', authToken.substring(0, 10) + '...');
  }
  console.log('Cookies available:', req.cookies.getAll().map(c => c.name).join(', '));
  return authToken;
};

// Validate if a string is a valid Firebase UID
const isValidFirebaseUID = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Firebase UIDs are typically 28 characters, but can vary
  // They're alphanumeric and we'll allow a range of 20-36 chars to be safe
  return /^[a-zA-Z0-9]{20,36}$/.test(id);
};

// Send friend request
export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { friendId } = body;
    
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }
    
    // Validate friendId format
    if (!isValidFirebaseUID(friendId)) {
      console.error('Invalid friendId format:', friendId);
      return NextResponse.json({ 
        error: 'Invalid friend ID format. Must be a valid Firebase UID.' 
      }, { status: 400 });
    }
    
    // Get and debug authentication token
    const authToken = debugAuth(request);
    
    if (!authToken) {
      return NextResponse.json({ error: 'Please sign in to add friends' }, { status: 401 });
    }
    
    console.log('Sending friend request to backend:', `${API_URL}/friends/request`);
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ friendId }),
    });
    
    // Debug the response
    console.log('Backend response status:', response.status);
    
    // Return the response from the backend
    const data = await response.json();
    console.log('Backend response data:', data);
    
    if (!response.ok) {
      // If it's an authentication error, provide a clearer message
      if (response.status === 401) {
        console.error('Authentication failed at backend');
        return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
      }
      return NextResponse.json({ error: data.message || 'Failed to send friend request' }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending friend request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get friends list
export async function GET(request: NextRequest) {
  try {
    // Get and debug authentication token
    const authToken = debugAuth(request);
    
    if (!authToken) {
      // Return empty array instead of error
      return NextResponse.json([]);
    }
    
    console.log('Fetching friends list from backend:', `${API_URL}/friends`);
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/friends`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('Backend response status:', response.status);
    
    // Handle authentication errors gracefully
    if (response.status === 401) {
      console.error('Authentication failed at backend');
      return NextResponse.json([]);
    }
    
    // Return the response from the backend
    const data = await response.json();
    console.log('Backend response data:', data);
    
    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Failed to get friends list' }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting friends list:', error);
    // Return empty array instead of error
    return NextResponse.json([]);
  }
} 