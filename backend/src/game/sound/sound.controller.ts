import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SoundService } from './sound.service';
import { PlayerSoundSettings } from './sound.types';

class UpdateSoundDto {
  enabled: boolean;
}

@Controller('api/sound')
export class SoundController {
  constructor(private readonly soundService: SoundService) {}

  /**
   * Get a player's sound settings
   * @param userId The user ID
   * @returns The player's sound settings
   */
  @Get(':userId')
  getSoundSettings(@Param('userId') userId: string): PlayerSoundSettings {
    return this.soundService.getSoundSettings(userId);
  }

  /**
   * Update a player's sound settings
   * @param userId The user ID
   * @param updateSoundDto The sound settings to update
   * @returns The updated sound settings
   */
  @Put(':userId')
  updateSoundSettings(
    @Param('userId') userId: string,
    @Body() updateSoundDto: UpdateSoundDto,
  ): PlayerSoundSettings {
    return this.soundService.updateSoundSettings(
      userId, 
      updateSoundDto.enabled
    );
  }
} 