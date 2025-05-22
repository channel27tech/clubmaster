import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GameRepositoryService } from '../game/game-repository.service';
import { Logger } from '@nestjs/common';

/**
 * Script to update existing games in the database with a customId
 * This is needed for games created before the customId column was added
 */
async function bootstrap() {
  const logger = new Logger('UpdateGameCustomIds');
  logger.log('Starting script to update game custom IDs...');

  // Create a NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the GameRepositoryService
    const gameRepositoryService = app.get(GameRepositoryService);
    
    // Get all games from the database
    const games = await gameRepositoryService.findAll();
    logger.log(`Found ${games.length} games in the database`);
    
    // Count how many games need to be updated
    const gamesWithoutCustomId = games.filter(game => !game.customId);
    logger.log(`Found ${gamesWithoutCustomId.length} games without a customId`);
    
    // Update each game that doesn't have a customId
    let updatedCount = 0;
    for (const game of gamesWithoutCustomId) {
      // Generate a custom ID in the format game_timestamp_shortId
      const timestamp = Date.now();
      const shortId = Math.random().toString(36).substring(2, 9);
      const customId = `game_${timestamp}_${shortId}`;
      
      // Update the game with the new customId
      await gameRepositoryService.update(game.id, { customId });
      
      logger.log(`Updated game ${game.id} with customId ${customId}`);
      updatedCount++;
    }
    
    logger.log(`Successfully updated ${updatedCount} games with custom IDs`);
  } catch (error) {
    logger.error(`Error updating game custom IDs: ${error.message}`, error.stack);
  } finally {
    // Close the application context
    await app.close();
    logger.log('Script completed');
  }
}

// Run the script
bootstrap();
