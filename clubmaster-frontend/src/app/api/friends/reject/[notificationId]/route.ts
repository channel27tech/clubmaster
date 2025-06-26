import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Reject friend request
export async function PATCH(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const { notificationId } = params;
    
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }
    
    // Get authentication token from cookies
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Please sign in to reject friend requests' }, { status: 401 });
    }
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/friends/reject/${notificationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    // Return the response from the backend
    const data = await response.json();
    
    if (!response.ok) {
      // If it's an authentication error, provide a clearer message
      if (response.status === 401) {
        return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
      }
      return NextResponse.json({ error: data.message || 'Failed to reject friend request' }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 