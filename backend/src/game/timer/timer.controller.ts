import { Controller, Post, Body, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { TimerService, TimeControl } from './timer.service';

@Controller('api/timer')
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @Post('initialize')
  initializeTimer(
    @Body() body: { gameId: string; timeControl: TimeControl },
  ) {
    try {
      const timer = this.timerService.initializeTimer(body.gameId, body.timeControl);
      return { success: true, timer };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to initialize timer',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':gameId/start')
  startTimer(@Param('gameId') gameId: string) {
    try {
      this.timerService.startTimer(gameId);
      return { success: true };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error.message || 'Failed to start timer',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':gameId/pause')
  pauseTimer(@Param('gameId') gameId: string) {
    try {
      this.timerService.pauseTimer(gameId);
      return { success: true };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error.message || 'Failed to pause timer',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':gameId/switch-turn')
  switchTurn(@Param('gameId') gameId: string) {
    try {
      this.timerService.switchTurn(gameId);
      return { success: true };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        error.message || 'Failed to switch turn',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':gameId/state')
  getTimerState(@Param('gameId') gameId: string) {
    try {
      const timer = this.timerService.getTimerState(gameId);
      if (!timer) {
        throw new HttpException('Timer not found', HttpStatus.NOT_FOUND);
      }
      return { success: true, timer };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to get timer state',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':gameId/time-out')
  checkTimeOut(@Param('gameId') gameId: string) {
    try {
      const hasTimeRunOut = this.timerService.hasTimeRunOut(gameId);
      return { success: true, hasTimeRunOut };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error.message || 'Failed to check time out',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':gameId/cleanup')
  cleanupTimer(@Param('gameId') gameId: string) {
    try {
      this.timerService.cleanupTimer(gameId);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to cleanup timer',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 