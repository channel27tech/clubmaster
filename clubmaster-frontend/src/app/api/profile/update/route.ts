import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route for updating the current user's profile
 * This acts as a proxy to the backend service
 */
export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Get the bearer token from the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization required' },
        { status: 401 }
      );
    }

    // Get the request body
    const body = await req.json();

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}/profile/update`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Get the response data
    const data = await response.json();

    // Return the same status code and data from the backend
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying profile update request:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 