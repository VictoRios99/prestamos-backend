import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private loansService: LoansService,
  ) {}

  async getDashboardSummary() {
    return this.loansService.getDashboardStats();
  }

  async getMonthlyInterestReport(year: number) {
    // Implementar lógica para reporte mensual de intereses
    const payments = await this.paymentsRepository.find({
      where: {
        paymentDate: Between(
          new Date(year, 0, 1),
          new Date(year, 11, 31)
        ),
      },
      relations: ['loan'],
    });

    const monthlyData = Array(12).fill(0).map(() => ({
      interest: 0,
      capital: 0,
      total: 0,
    }));

    // Aquí necesitaríamos acceso a los datos de interés/capital de cada pago
    // Por ahora retornamos estructura básica
    
    return monthlyData.map((data, index) => ({
      month: index + 1,
      monthName: new Date(year, index).toLocaleString('es', { month: 'long' }),
      ...data,
    }));
  }

  async getPaymentsByDateRange(startDate: Date, endDate: Date) {
    return this.paymentsRepository.find({
      where: {
        paymentDate: Between(startDate, endDate),
      },
      relations: ['loan', 'loan.customer'],
      order: { paymentDate: 'DESC' },
    });
  }
}