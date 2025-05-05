import { Module } from '@nestjs/common';
import { SoundController } from './sound.controller';
import { SoundService } from './sound.service';
import { SoundGateway } from './sound.gateway';

@Module({
  controllers: [SoundController],
  providers: [SoundService, SoundGateway],
  exports: [SoundService],
})
export class SoundModule {} 