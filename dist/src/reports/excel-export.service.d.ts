import { Repository } from 'typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { Loan } from '../loans/entities/loan.entity';
export declare class ExcelExportService {
    private paymentsRepository;
    private loansRepository;
    constructor(paymentsRepository: Repository<Payment>, loansRepository: Repository<Loan>);
    exportPayments(startDate?: Date, endDate?: Date): Promise<Buffer>;
    private createPaymentsSheet;
    private createSummarySheet;
    private calculateStats;
    private getPaymentTypeText;
    private formatDateRange;
}
