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
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATOR)
  create(@Body() createPaymentDto: CreatePaymentDto, @Req() req: Request) {
    return this.paymentsService.create(
      createPaymentDto,
      (req.user as any).userId,
    );
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
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(+id);
  }
}
