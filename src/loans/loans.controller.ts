import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATOR)
  create(@Body() createLoanDto: CreateLoanDto, @Req() req: Request) {
    return this.loansService.create(createLoanDto, (req.user as any).userId);
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
  remove(@Param('id') id: string) {
    return this.loansService.remove(+id);
  }
}
