import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Loan } from '../loans/entities/loan.entity';
import { MonthlyPayment } from '../loans/entities/monthly-payment.entity';
import { CashMovementsModule } from '../cash-movements/cash-movements.module';
import { LoansModule } from '../loans/loans.module';
import { IsAfterLoanDateConstraint } from '../common/validators/is-after-loan-date.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Loan, MonthlyPayment]),
    CashMovementsModule,
    LoansModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, IsAfterLoanDateConstraint],
  exports: [PaymentsService],
})
export class PaymentsModule {}
