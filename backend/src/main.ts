// Add crypto module polyfill globally to fix TypeORM issue with randomUUID
import * as crypto from 'crypto';

// Only assign globalThis.crypto if it does not already exist (for Node.js < 20)
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = crypto.webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
 
// If your application needs crypto functionality, create a utility instead
// Example: create a cryptoUtils file or use the crypto module directly where needed
 
// This is the main function that starts the server
async function bootstrap() { 
  const logger = new Logger('Bootstrap'); 
  // Create the NestJS application
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
 
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
 
  // Increase payload size limit for large requests (e.g., base64 images)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
 
  // Serve static files from public/uploads at /uploads
  app.useStaticAssets(join(__dirname, '..', 'public', 'uploads'), {
    prefix: '/uploads/',
  });

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Clubmaster API')
    .setDescription('The Clubmaster API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Firebase JWT token',
        in: 'header',
      },
      'firebase-jwt', // This is the security scheme name used in @ApiBearerAuth() decorator
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('friends', 'Friend management endpoints')
    .addTag('notifications', 'Notification management endpoints')
    .addTag('profile', 'User profile endpoints')
    .addTag('game', 'Game management endpoints')
    .addTag('club', 'Club management endpoints')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
 
  // Try ports in sequence until one works
  const tryPort = async (port: number): Promise<number> => {
    try {
      await app.listen(port);
      logger.log(`Application is running on: http://localhost:${port}`);
      logger.log(`API Documentation available at: http://localhost:${port}/api`);
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