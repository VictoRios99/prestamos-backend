import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityService, FindAllFilters } from './activity.service';
import { ActivityAction } from './entities/activity-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: ActivityAction,
    @Query('search') search?: string,
    @Query('period') period?: 'today' | '7d' | '30d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: FindAllFilters = {
      userId: userId ? +userId : undefined,
      action,
      search,
      period,
      startDate,
      endDate,
      page: page ? +page : 1,
      limit: limit ? +limit : 30,
    };
    return this.activityService.findAll(filters);
  }
}
