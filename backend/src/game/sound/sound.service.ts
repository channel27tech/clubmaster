import { Injectable } from '@nestjs/common';
import { PlayerSoundSettings } from './sound.types';

@Injectable()
export class SoundService {
  // In-memory store for sound settings
  // In a production app, this would be stored in a database
  private soundSettings: Map<string, PlayerSoundSettings> = new Map();

  /**
   * Get a player's sound settings
   * @param userId The user ID
   * @returns The player's sound settings
   */
  getSoundSettings(userId: string): PlayerSoundSettings {
    if (!this.soundSettings.has(userId)) {
      // Default sound settings
      this.soundSettings.set(userId, {
        userId,
        soundEnabled: true, // Enabled by default
      });
    }
    
    return this.soundSettings.get(userId)!;
  }

  /**
   * Update a player's sound settings
   * @param userId The user ID
   * @param enabled Whether sound is enabled
   * @returns The updated sound settings
   */
  updateSoundSettings(userId: string, enabled: boolean): PlayerSoundSettings {
    const settings = this.getSoundSettings(userId);
    settings.soundEnabled = enabled;
    this.soundSettings.set(userId, settings);
    
    return settings;
  }
} 