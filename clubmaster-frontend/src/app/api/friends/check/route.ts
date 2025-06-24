import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Debug function to help trace authentication issues
const debugAuth = (req: NextRequest) => {
  const authToken = req.cookies.get('authToken')?.value;
  console.log('API Route Debug - /api/friends/check:');
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

// Check if users are friends
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const friendId = searchParams.get('friendId');
    
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }
    
    // Validate friendId format
    if (!isValidFirebaseUID(friendId)) {
      console.error('Invalid friendId format:', friendId);
      return NextResponse.json({ areFriends: false }, { status: 200 });
    }
    
    // Get and debug authentication token
    const authToken = debugAuth(request);
    
    if (!authToken) {
      console.log('No auth token found, returning areFriends: false');
      return NextResponse.json({ areFriends: false }, { status: 200 });
    }
    
    console.log(`Checking friendship with backend: ${API_URL}/friends/check?friendId=${friendId}`);
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/friends/check?friendId=${friendId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        // If unauthorized, just return false instead of an error
        console.error('Authentication failed at backend');
        return NextResponse.json({ areFriends: false }, { status: 200 });
      }
      
      const data = await response.json();
      console.error('Backend error response:', data);
      return NextResponse.json({ error: data.message || 'Failed to check friendship status' }, { status: response.status });
    }
    
    // Return the response from the backend
    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking friendship status:', error);
    // Don't return an error, just return false
    return NextResponse.json({ areFriends: false }, { status: 200 });
  }
} 