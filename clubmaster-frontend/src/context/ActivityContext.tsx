'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import * as activityService from '../services/activityService';
import { UserActivity, UserActivityStatus } from '../types/activity';

// Context type definition
interface ActivityContextType {
  userActivities: Map<string, UserActivity>;
  currentUserActivity: UserActivity | null;
  isActivitySocketConnected: boolean;
  getUserActivityById: (userId: string) => UserActivity | undefined;
  getStatusText: (status: UserActivityStatus) => string;
  getTimeElapsed: (lastActive: Date) => string;
}

// Create the context with default values
const ActivityContext = createContext<ActivityContextType>({
  userActivities: new Map(),
  currentUserActivity: null,
  isActivitySocketConnected: false,
  getUserActivityById: () => undefined,
  getStatusText: () => 'Unknown',
  getTimeElapsed: () => '',
});

// Props for the ActivityProvider component
interface ActivityProviderProps {
  children: ReactNode;
}

// Activity provider component
export const ActivityProvider: React.FC<ActivityProviderProps> = ({ children }) => {
  // Get auth context for current user
  const { user } = useAuth();
  
  // State for storing user activities
  const [userActivities, setUserActivities] = useState<Map<string, UserActivity>>(new Map());
  
  // State for current user's activity
  const [currentUserActivity, setCurrentUserActivity] = useState<UserActivity | null>(null);
  
  // State for tracking connection status
  const [isActivitySocketConnected, setIsActivitySocketConnected] = useState<boolean>(false);

  // Effect for initializing the activity socket when the user changes
  useEffect(() => {
    // Only connect if we have a user
    if (!user) {
      return;
    }

    // Connect to the activity socket
    const socket = activityService.connectActivitySocket(user.uid);

    // Set up event handlers
    socket.on('connect', () => {
      console.log('Activity socket connected');
      setIsActivitySocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Activity socket disconnected');
      setIsActivitySocketConnected(false);
    });

    // Handle initial activity state
    activityService.onInitialActivityState((activities: UserActivity[]) => {
      console.log('Received initial activity state:', activities);
      
      // Convert array to map for efficient lookups
      const activitiesMap = new Map<string, UserActivity>();
      activities.forEach((activity) => {
        activitiesMap.set(activity.userId, activity);
      });
      
      setUserActivities(activitiesMap);
      
      // Set current user's activity if available
      const currentActivity = activities.find((activity) => activity.userId === user.uid);
      if (currentActivity) {
        setCurrentUserActivity(currentActivity);
      }
    });

    // Handle activity updates
    activityService.onUserActivityUpdate((activities: UserActivity[]) => {
      console.log('Received activity update:', activities);
      
      // Update our map of activities
      setUserActivities((prevActivities) => {
        const newActivities = new Map(prevActivities);
        
        activities.forEach((activity) => {
          newActivities.set(activity.userId, activity);
        });
        
        return newActivities;
      });
      
      // Update current user's activity if included
      const currentActivity = activities.find((activity) => activity.userId === user.uid);
      if (currentActivity) {
        setCurrentUserActivity(currentActivity);
      }
    });

    // Clean up on unmount or when user changes
    return () => {
      // Remove event handlers
      activityService.offInitialActivityState();
      activityService.offUserActivityUpdate();
      
      // Disconnect the socket
      activityService.disconnectActivitySocket();
      
      // Reset state
      setUserActivities(new Map());
      setCurrentUserActivity(null);
      setIsActivitySocketConnected(false);
    };
  }, [user]);

  // Get a user's activity by ID
  const getUserActivityById = (userId: string): UserActivity | undefined => {
    return userActivities.get(userId);
  };

  // Context value
  const contextValue: ActivityContextType = {
    userActivities,
    currentUserActivity,
    isActivitySocketConnected,
    getUserActivityById,
    getStatusText: activityService.getStatusText,
    getTimeElapsed: activityService.getTimeElapsed,
  };

  return (
    <ActivityContext.Provider value={contextValue}>
      {children}
    </ActivityContext.Provider>
  );
};

// Custom hook for using the activity context
export const useActivity = (): ActivityContextType => {
  const context = useContext(ActivityContext);
  
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  
  return context;
}; 