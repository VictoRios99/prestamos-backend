import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Throttle } from '@nestjs/throttler';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private activityService: ActivityService,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(
      loginDto.username,
      loginDto.password,
    );
    this.activityService.log({
      action: ActivityAction.LOGIN,
      userId: result.user.id,
      userName: result.user.fullName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const user = req.user as any;
    this.activityService.log({
      action: ActivityAction.LOGOUT,
      userId: user.userId,
      userName: user.fullName || user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: 'Sesion cerrada' };
  }
}
