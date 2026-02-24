import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { Request } from 'express';
import { getClientIp } from '../common/utils/get-client-ip';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.AUDITOR)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('stats')
  async getDashboardStats(@Req() req: Request) {
    const user = req.user as any;
    this.activityService.log({
      action: ActivityAction.VIEW_DASHBOARD,
      userId: user.userId,
      userName: user.fullName || user.username,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return this.dashboardService.getDashboardStats();
  }

  @Get('capital-distribution')
  async getCapitalDistribution() {
    return this.dashboardService.getCapitalDistribution();
  }

  @Get('payment-log')
  async getPaymentActivityLog(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year, 10) : now.getFullYear();
    return this.dashboardService.getPaymentActivityLog(m, y);
  }

  @Get('loans-status')
  async getLoansWithPaymentStatus() {
    return this.dashboardService.getLoansWithPaymentStatus();
  }
}
