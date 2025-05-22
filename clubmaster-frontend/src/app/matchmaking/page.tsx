import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';

const MatchmakingPage: React.FC = () => {
  const socket = useSocket();
  const auth = useAuth();

  const startMatchmaking = useCallback(() => {
    if (!socket || !socket.connected) {
      console.error('Socket is not connected');
      return;
    }

    // Get current user from Firebase Auth
    const currentUser = auth.currentUser;
    
    // Create matchmaking request payload with proper authentication data
    const matchmakingRequest = {
      gameMode: selectedMode,
      timeControl: selectedTimeControl,
      rated: enableRating,
      preferredSide: selectedSide,
      // Properly set the firebase UID - don't default to "guest"
      firebaseUid: currentUser ? currentUser.uid : "guest",
      // Include display name if available
      username: currentUser?.displayName || undefined
    };

    console.log('Starting matchmaking with options:', matchmakingRequest);
    
    // Emit the event with proper authentication data
    socket.emit('startMatchmaking', matchmakingRequest);
    setMatchmakingStatus('searching');
  }, [socket, selectedMode, selectedTimeControl, enableRating, selectedSide, auth]);

  return (
    <div>
      {/* Rest of the component code */}
    </div>
  );
};

export default MatchmakingPage; 