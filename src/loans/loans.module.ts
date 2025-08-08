import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { Loan } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CashMovementsModule } from '../cash-movements/cash-movements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, MonthlyPayment]),
    CashMovementsModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
