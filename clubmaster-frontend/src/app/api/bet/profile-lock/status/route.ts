import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for checking profile lock status
 * GET: Check if the current user's profile is locked
 */
export async function GET(request: NextRequest) {
  try {
    // SIMPLIFICATION: In a real implementation, we would validate the token with Firebase admin
    // For now, we'll extract the user ID from the Authorization header directly
    const token = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In a real implementation, we would verify this token
    // For this demo, we'll just use the token as the user ID
    const userId = token;

    // Forward the request to the backend
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/profile-lock/status`, {
      headers: {
        'user_id': userId
      }
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in profile-lock/status GET API:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
} 