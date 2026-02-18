import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(@Body() createLoanDto: CreateLoanDto, @Req() req: Request) {
    return this.loansService.create(createLoanDto, (req.user as any).userId);
  }

  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Get('completed') // New endpoint for completed loans
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
  remove(@Param('id') id: string) {
    return this.loansService.remove(+id);
  }
}
