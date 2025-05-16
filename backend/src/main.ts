// Add crypto module polyfill globally
import * as crypto from 'crypto';
global.crypto = crypto as any;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Enable CORS with expanded configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      // Add any other frontend origins like production domains
      // 'https://your-production-domain.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-Requested-With',
      'Range',
      'Origin'
    ],
    exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges'],
    maxAge: 3600,
  });

  // Use WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  // Try ports in sequence until one works
  const tryPort = async (port: number): Promise<number> => {
    try {
      await app.listen(port);
      logger.log(`Application is running on: http://localhost:${port}`);
      logger.log(`WebSocket endpoint available at: ws://localhost:${port}/chess`);
      return port;
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is in use, trying ${port + 1}...`);
        return tryPort(port + 1);
      }
      throw error;
    }
  };

  // Start with port 3001 (since frontend uses 3000)
  const defaultPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await tryPort(defaultPort);
}
bootstrap();
