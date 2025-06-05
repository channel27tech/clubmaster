import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';

// Mock Socket.IO objects
const mockSocket = {
  id: 'test-socket-id',
  handshake: {
    query: {
      userId: 'test-user-123',
    },
  },
  join: jest.fn().mockImplementation((room) => Promise.resolve()),
  emit: jest.fn(),
  disconnect: jest.fn(),
} as unknown as Socket;

const mockServer = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
} as unknown as Server;

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    // Mock the server instance
    gateway.server = mockServer;
    // Mock the logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should add the socket to the user room', async () => {
      await gateway.handleConnection(mockSocket);
      expect(mockSocket.join).toHaveBeenCalledWith('test-user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connection_established',
        expect.objectContaining({
          status: 'connected',
          socketId: 'test-socket-id',
        })
      );
    });

    it('should disconnect if no userId is provided', async () => {
      const socketWithoutUserId = {
        ...mockSocket,
        handshake: { query: {} },
      } as unknown as Socket;
      
      await gateway.handleConnection(socketWithoutUserId);
      expect(socketWithoutUserId.disconnect).toHaveBeenCalled();
      expect(socketWithoutUserId.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove the socket from tracked connections', async () => {
      // First connect to add the socket
      await gateway.handleConnection(mockSocket);
      
      // Then disconnect
      gateway.handleDisconnect(mockSocket);
      
      // Check that the user has no connections
      expect(gateway.getUserConnectionCount('test-user-123')).toBe(0);
    });
  });

  describe('handleJoinRoom', () => {
    it('should join the specified room', () => {
      const result = gateway.handleJoinRoom(mockSocket, { userId: 'new-room-123' });
      expect(mockSocket.join).toHaveBeenCalledWith('new-room-123');
      expect(result).toEqual({ success: true });
    });

    it('should return false if no userId is provided', () => {
      const result = gateway.handleJoinRoom(mockSocket, { userId: '' });
      expect(result).toEqual({ success: false });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToUser', () => {
    it('should emit an event to the user room', () => {
      const userId = 'test-user-123';
      const event = 'new_notification';
      const payload = { id: '1', message: 'Test notification' };
      
      const result = gateway.emitToUser(userId, event, payload);
      
      expect(mockServer.to).toHaveBeenCalledWith(userId);
      expect(mockServer.emit).toHaveBeenCalledWith(event, payload);
      expect(result).toBe(true);
    });
  });

  describe('getUserConnectionCount', () => {
    it('should return the number of connections for a user', async () => {
      // Connect a user
      await gateway.handleConnection(mockSocket);
      
      // Check connection count
      expect(gateway.getUserConnectionCount('test-user-123')).toBe(1);
      
      // Check for non-existent user
      expect(gateway.getUserConnectionCount('non-existent')).toBe(0);
    });
  });
}); 