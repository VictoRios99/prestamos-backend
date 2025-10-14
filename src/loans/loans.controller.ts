import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(@Body() createLoanDto: CreateLoanDto) {
    return this.loansService.create(createLoanDto, 1); // userId fijo
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
