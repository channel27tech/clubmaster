import axios from 'axios';

export const createClub = async (clubData: any, token: string) => {
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/club`,
    clubData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

export const joinClub = async (clubId: number, token: string) => {
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/club-member/join`,
    { clubId },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}; 