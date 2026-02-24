import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATOR)
  async create(@Body() createPaymentDto: CreatePaymentDto, @Req() req: Request) {
    const user = req.user as any;
    const payment = await this.paymentsService.create(createPaymentDto, user.userId);
    this.activityService.log({
      action: ActivityAction.CREATE_PAYMENT,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'payment',
      entityId: payment.id,
      details: { amount: createPaymentDto.amount, loanId: createPaymentDto.loanId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return payment;
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(+id);
  }

  @Get('history/:loanId')
  getPaymentHistory(@Param('loanId') loanId: string) {
    return this.paymentsService.getPaymentHistory(+loanId);
  }

  @Get('loan/:loanId')
  findByLoan(@Param('loanId') loanId: string) {
    return this.paymentsService.findByLoan(+loanId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const result = await this.paymentsService.remove(+id);
    this.activityService.log({
      action: ActivityAction.DELETE_PAYMENT,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'payment',
      entityId: +id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
