import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';
import { TimerGateway } from './timer.gateway';

@Module({
  providers: [TimerService, TimerGateway],
  controllers: [TimerController],
  exports: [TimerService],
})
export class TimerModule {} 