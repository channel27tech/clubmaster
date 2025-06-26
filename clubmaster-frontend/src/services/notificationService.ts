import { getAuth } from 'firebase/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchNotifications(limit = 50, offset = 0) {
  const auth = getAuth();
  const user = auth.currentUser;
  const url = `${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}`;
  let token = '';
  if (user) {
    token = await user.getIdToken();
  }
  const res = await fetch(url, {
    credentials: 'include', // if you use cookies/auth
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
} 