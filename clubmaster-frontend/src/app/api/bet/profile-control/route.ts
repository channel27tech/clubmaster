import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for profile control
 * PATCH: Update a user's profile under profile control
 */
export async function PATCH(request: NextRequest) {
  try {
    // Extract the token from the incoming request
    const token = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('targetUserId');
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId parameter' }, { status: 400 });
    }

    const requestBody = await request.json();
    const { nickname, avatarType } = requestBody;

    const backendUrl = `${process.env.API_URL}/bet/profile-control?targetUserId=${targetUserId}`;
    console.log(`[API Route] Forwarding request to backend: ${backendUrl}`);

    // Forward the request to the backend with the correct Authorization header
    const backendResponse = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        nickname,
        avatarType
      })
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('Backend error:', errorData);
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in profile-control PATCH API:', error);
    const errorMsg = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({ error: errorMsg || 'An error occurred while processing your request' }, { status: 500 });
  }
}

/**
 * API route for checking profile control
 * GET: Check if user has control over target user's profile
 */
export async function GET(request: NextRequest) {
  try {
    // Extract the token from the incoming request
    const token = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('targetUserId');
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId parameter' }, { status: 400 });
    }

    const backendUrl = `${process.env.API_URL}/bet/profile-control/check?targetUserId=${targetUserId}`;
    console.log(`[API Route] Forwarding GET request to backend: ${backendUrl}`);

    // Forward the request to the backend with the correct Authorization header
    const backendResponse = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in profile-control GET API:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
} 