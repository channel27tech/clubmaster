import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route for fetching a specific user's profile by ID
 * This acts as a proxy to the backend service
 */
export async function GET(request: NextRequest) {
  try {
    // Extract userId from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Get the bearer token from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization required' },
        { status: 401 }
      );
    }

    console.log(`Fetching profile for user ${userId}`);

    // Forward the request to the backend
    const response = await fetch(`${baseUrl}/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error(`Backend returned error status: ${response.status}`);
      return NextResponse.json(
        { message: 'Backend service error' },
        { status: response.status }
      );
    }

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