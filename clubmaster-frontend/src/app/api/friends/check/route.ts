import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const friendId = searchParams.get('friendId');
    
    if (!userId || !friendId) {
      return NextResponse.json({ error: 'Both userId and friendId are required' }, { status: 400 });
    }
    
    // Get authentication token from cookies
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/users/${userId}/friends/check/${friendId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    // Return the response from the backend
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Failed to check friend status' }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking friend status:', error);
    return NextResponse.json({ error: 'Internal server error', isFriend: false }, { status: 500 });
  }
} 