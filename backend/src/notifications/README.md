# Clubmaster Notifications Module

This module provides a complete notification system for the Clubmaster application, including:

- REST API endpoints for managing notifications
- WebSocket integration for real-time notification delivery
- Support for various notification types (game invites, friend requests, etc.)
- Filtering, pagination, and read status management

## Features

- Real-time notifications via WebSockets
- Persistent storage of notifications in the database
- Type-safe notification definitions
- Authentication and authorization checks
- REST API for managing notifications

## API Endpoints

| Method | Endpoint                  | Description                                | Authentication |
|--------|---------------------------|--------------------------------------------|---------------|
| GET    | /notifications            | Get notifications with optional filtering  | Required      |
| GET    | /notifications/unread-count | Get count of unread notifications        | Required      |
| PATCH  | /notifications/:id/read   | Mark a specific notification as read       | Required      |
| PATCH  | /notifications/read-all   | Mark all notifications as read             | Required      |
| DELETE | /notifications/:id        | Delete a notification                      | Required      |

### GET /notifications

Retrieves notifications for the authenticated user with optional filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by notification status (READ or UNREAD)
- `type` (optional): Filter by notification type
- `limit` (optional): Maximum number of notifications to return (default: 20)
- `offset` (optional): Number of notifications to skip (default: 0)

**Response:**
```json
{
  "notifications": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "recipientUserId": "user123",
      "senderUserId": "user456",
      "type": "FRIEND_REQUEST",
      "data": {
        "message": "Would you like to be friends?"
      },
      "status": "UNREAD",
      "createdAt": "2023-07-15T14:30:00.000Z"
    }
  ],
  "total": 1
}
```

### GET /notifications/unread-count

Returns the count of unread notifications for the authenticated user.

**Response:**
```json
{
  "count": 5
}
```

### PATCH /notifications/:id/read

Marks a specific notification as read.

**URL Parameters:**
- `id`: The ID of the notification to mark as read

**Response:**
The updated notification object.

### PATCH /notifications/read-all

Marks all notifications for the authenticated user as read.

**Response:**
```json
{
  "affected": 5
}
```

### DELETE /notifications/:id

Deletes a notification.

**URL Parameters:**
- `id`: The ID of the notification to delete

**Response:**
HTTP 204 No Content

## WebSocket Integration

The notification system uses WebSockets for real-time delivery. Clients can connect to the WebSocket server to receive notifications instantly.

### Connecting to the WebSocket

```javascript
// Client-side code
const socket = io(`${API_URL}/notifications`, {
  query: { userId: 'user123' }
});

socket.on('connect', () => {
  console.log('Connected to notifications socket');
});

socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
});
```

### Events

| Event                  | Direction       | Description                             |
|------------------------|----------------|-----------------------------------------|
| connection_established | Server → Client | Sent when the connection is established |
| new_notification       | Server → Client | Sent when a new notification is created |
| join_user_room         | Client → Server | Join a specific user's notification room |

## Notification Types

The system supports various notification types defined in the `NotificationType` enum:

- `FRIEND_REQUEST`: Friend request notifications
- `GAME_INVITE`: Game invitation notifications
- `TOURNAMENT_ALERT`: Tournament-related notifications
- `CLUB_ROLE_UPDATE`: Club role changes
- `GAME_RESULT`: Game result notifications
- `MATCH_READY`: Match ready notifications
- `SYSTEM_ALERT`: System-wide notifications

## Usage Examples

### Sending a Notification from Another Service

```typescript
// Inject the NotificationsService
constructor(private readonly notificationsService: NotificationsService) {}

// Send a game invite notification
async sendGameInvite(fromUserId: string, toUserId: string, gameId: string) {
  await this.notificationsService.sendNotification(
    toUserId,
    NotificationType.GAME_INVITE,
    {
      senderUserId: fromUserId,
      gameId,
      message: 'You have been invited to a game'
    }
  );
}
```

### Frontend Integration

```typescript
// Using React with custom hook
function Header() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  return (
    <div>
      <NotificationBell count={unreadCount} />
      <NotificationList 
        notifications={notifications} 
        onMarkAsRead={markAsRead} 
      />
    </div>
  );
}
```

## Architecture

The notifications module consists of:

1. **Entity**: `Notification` - Database model for notifications
2. **DTOs**: Data Transfer Objects for validation and type safety
3. **Service**: `NotificationsService` - Business logic for notifications
4. **Controller**: `NotificationsController` - REST API endpoints
5. **Gateway**: `NotificationsGateway` - WebSocket integration
6. **Enums**: Type definitions for notification types and statuses

This architecture ensures a clean separation of concerns and makes the module easy to maintain and extend. 