import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000'], // Allow frontend origin
    methods: ['GET', 'POST'],
    credentials: true,
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
