import { Repository } from 'typeorm';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
import { LoansService } from '../loans/loans.service';
export declare class ReportsService {
    private loansRepository;
    private paymentsRepository;
    private loansService;
    constructor(loansRepository: Repository<Loan>, paymentsRepository: Repository<Payment>, loansService: LoansService);
    getDashboardSummary(): Promise<any>;
    getMonthlyInterestReport(year: number): Promise<{
        interest: number;
        capital: number;
        total: number;
        month: number;
        monthName: string;
    }[]>;
    getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]>;
}
