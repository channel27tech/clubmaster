import { NextRequest, NextResponse } from 'next/server';
import { isValidFirebaseUID } from '../../../../utils/friendUtils';

// Define the API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper function to debug auth header
function debugAuth(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    console.log('No authorization header found');
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('No token found in authorization header');
    return null;
  }
  
  // For security, don't log the actual token, just acknowledge it exists
  console.log('Authorization token found');
  return token;
}

// Check if there's a pending friend request
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
      return NextResponse.json({ isPending: false }, { status: 200 });
    }
    
    // Get and debug authentication token
    const authToken = debugAuth(request);
    
    if (!authToken) {
      console.log('No auth token found, returning isPending: false');
      return NextResponse.json({ isPending: false }, { status: 200 });
    }
    
    console.log(`Checking pending friend request with backend: ${API_URL}/friends/pending?friendId=${friendId}`);
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/friends/pending?friendId=${friendId}`, {
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
        return NextResponse.json({ isPending: false }, { status: 200 });
      }
      
      const data = await response.json();
      console.error('Backend error response:', data);
      return NextResponse.json({ error: data.message || 'Failed to check pending status' }, { status: response.status });
    }
    
    // Return the response from the backend
    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking pending friend request:', error);
    return NextResponse.json({ error: 'Internal server error', isPending: false }, { status: 500 });
  }
} 