'use client';

import React, { useEffect, useState } from 'react';
import { useActivity } from '../context/ActivityContext';
import { UserActivity, UserActivityStatus } from '../types/activity';

interface PlayerActivityStatusProps {
  userId: string;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

const PlayerActivityStatus: React.FC<PlayerActivityStatusProps> = ({
  userId,
  showDetails = false,
  compact = false,
  className = '',
}) => {
  const { getUserActivityById, getStatusText, getTimeElapsed } = useActivity();
  const [activity, setActivity] = useState<UserActivity | undefined>(undefined);

  // Update activity whenever it changes
  useEffect(() => {
    setActivity(getUserActivityById(userId));
  }, [getUserActivityById, userId]);

  // If no activity data is available, show offline status
  if (!activity) {
    return (
      <div className={`player-activity-status ${className}`}>
        <div className="status-indicator offline"></div>
        {!compact && <span>Offline</span>}
      </div>
    );
  }

  // CSS class based on status
  const statusClass = activity.status.replace('-', ''); // Convert in-game to ingame for CSS

  return (
    <div className={`player-activity-status ${className}`}>
      <div className={`status-indicator ${statusClass}`}></div>
      {!compact && <span>{getStatusText(activity.status)}</span>}
      
      {showDetails && (
        <div className="activity-details">
          {activity.inGameId && activity.status === UserActivityStatus.IN_GAME && (
            <div className="game-info">Playing game: {activity.inGameId}</div>
          )}
          <div className="last-active">
            Last active: {getTimeElapsed(activity.lastActive)}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .player-activity-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
        }
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .status-indicator.online {
          background-color: #4CAF50; /* Green */
        }
        
        .status-indicator.away {
          background-color: #FFC107; /* Amber */
        }
        
        .status-indicator.offline {
          background-color: #9E9E9E; /* Grey */
        }
        
        .status-indicator.ingame {
          background-color: #2196F3; /* Blue */
        }
        
        .activity-details {
          margin-top: 4px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default PlayerActivityStatus; 