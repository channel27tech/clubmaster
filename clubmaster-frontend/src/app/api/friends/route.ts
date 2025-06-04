import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { friendId } = body;
    
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }
    
    // Get authentication token from cookies
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/users/friends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ friendId }),
    });
    
    // Return the response from the backend
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Failed to add friend' }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error adding friend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 