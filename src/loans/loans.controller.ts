import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { Request } from 'express';
import { getClientIp } from '../common/utils/get-client-ip';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATOR)
  async create(@Body() createLoanDto: CreateLoanDto, @Req() req: Request) {
    const user = req.user as any;
    const loan = await this.loansService.create(createLoanDto, user.userId);
    this.activityService.log({
      action: ActivityAction.CREATE_LOAN,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'loan',
      entityId: loan.id,
      details: { amount: createLoanDto.amount, loanType: createLoanDto.loanType },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return loan;
  }

  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Get('completed')
  findCompletedLoans() {
    return this.loansService.getCompletedLoans();
  }

  @Get('customer/:customerId')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.loansService.findByCustomer(+customerId);
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.loansService.getLoanDetails(+id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.loansService.getLoanDetails(+id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const result = await this.loansService.remove(+id);
    this.activityService.log({
      action: ActivityAction.DELETE_LOAN,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'loan',
      entityId: +id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
