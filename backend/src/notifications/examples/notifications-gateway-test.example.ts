import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { NotificationsModule } from '../notifications.module';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../enums/notification-type.enum';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { Notification } from '../entities/notification.entity';

/**
 * This is an example of how to test the NotificationsGateway with Socket.IO client.
 * 
 * NOTE: This is just an example and not meant to be used in production.
 * IMPORTANT: To use this example, you need to install socket.io-client:
 * npm install --save socket.io-client
 */
describe('NotificationsGateway (Integration)', () => {
  let app: INestApplication;
  let notificationsService: NotificationsService;
  let clientSocket: Socket;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    // Create a test module with the NotificationsModule
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationsModule],
    }).compile();

    // Create a NestJS application
    app = moduleFixture.createNestApplication();
    await app.listen(3001); // Use a different port than your main app

    // Get the NotificationsService
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

    // Connect a client socket
    clientSocket = io('http://localhost:3001/notifications', {
      query: { userId: testUserId },
      transports: ['websocket'],
    });

    // Wait for connection to be established
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        console.log('Client socket connected');
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Disconnect the client socket
    clientSocket.disconnect();
    
    // Close the application
    await app.close();
  });

  it('should receive notification when one is created', (done) => {
    // Listen for the new_notification event
    clientSocket.on('new_notification', (payload) => {
      try {
        // Verify the payload
        expect(payload).toBeDefined();
        expect(payload.id).toBeDefined();
        expect(payload.type).toBe(NotificationType.SYSTEM_ALERT);
        expect(payload.message).toBe('This is a test notification');
        
        // Test passed
        done();
      } catch (error) {
        done(error);
      }
    });

    // Create a notification for the test user
    const dto: CreateNotificationDto = {
      recipientUserId: testUserId,
      type: NotificationType.SYSTEM_ALERT,
      data: { message: 'This is a test notification' },
    };

    // Send the notification
    notificationsService.createNotification(dto).catch((error) => {
      done(error);
    });
  });

  it('should not receive notifications for other users', (done) => {
    // Set a timeout to ensure we don't receive the notification
    const timeout = setTimeout(() => {
      // If we reach here without receiving a notification, the test passes
      done();
    }, 1000);

    // Listen for the new_notification event
    clientSocket.on('new_notification', () => {
      // If we receive a notification, the test fails
      clearTimeout(timeout);
      done(new Error('Received notification intended for another user'));
    });

    // Create a notification for a different user
    const dto: CreateNotificationDto = {
      recipientUserId: 'different-user',
      type: NotificationType.SYSTEM_ALERT,
      data: { message: 'This should not be received by the test user' },
    };

    // Send the notification
    notificationsService.createNotification(dto).catch((error) => {
      clearTimeout(timeout);
      done(error);
    });
  });

  it('should send notification using sendNotification method', (done) => {
    // Listen for the new_notification event
    clientSocket.on('new_notification', (payload) => {
      try {
        // Verify the payload
        expect(payload).toBeDefined();
        expect(payload.id).toBeDefined();
        expect(payload.type).toBe(NotificationType.GAME_INVITE);
        expect(payload.data.gameId).toBe('game-123');
        expect(payload.senderUserId).toBe('sender-456');
        
        // Test passed
        done();
      } catch (error) {
        done(error);
      }
    });

    // Send a notification using the sendNotification method
    notificationsService.sendNotification(
      testUserId,
      NotificationType.GAME_INVITE,
      {
        senderUserId: 'sender-456',
        gameId: 'game-123',
        timeControl: '5+0',
      },
    ).catch((error) => {
      done(error);
    });
  });
}); 