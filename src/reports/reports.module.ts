import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ExcelExportService } from './excel-export.service';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { MonthlyPayment } from '../loans/entities/monthly-payment.entity';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { CashMovement } from '../cash-movements/entities/cash-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, Payment, MonthlyPayment, CashMovement])
  ],
  controllers: [ReportsController],
  providers: [
    ExcelExportService,
    LoansService,
    PaymentsService,
    CashMovementsService
  ],
  exports: [ExcelExportService],
})
export class ReportsModule {}
