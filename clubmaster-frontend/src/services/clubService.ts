import axios from 'axios';

export const createClub = async (clubData: any, token: string) => {
  const payload = { ...clubData };
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/club`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

export const joinClub = async (clubId: number, token: string, inviteToken?: string) => {
  const body: any = { clubId };
  if (inviteToken) body.inviteToken = inviteToken;
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/club-member/join`,
    body,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}; 