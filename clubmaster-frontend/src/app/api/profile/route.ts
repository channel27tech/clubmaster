import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route for fetching the current user's profile
 * This acts as a proxy to the backend service
 */
export async function GET(req: NextRequest) {
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

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    // Get the response data
    const data = await response.json();

    // Return the same status code and data from the backend
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying profile request:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 