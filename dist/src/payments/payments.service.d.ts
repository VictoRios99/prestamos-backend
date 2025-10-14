import { Repository, EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Loan } from '../loans/entities/loan.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { LoansService } from '../loans/loans.service';
export declare class PaymentsService {
    private paymentsRepository;
    private readonly loansService;
    private readonly cashMovementsService;
    private readonly entityManager;
    constructor(paymentsRepository: Repository<Payment>, loansService: LoansService, cashMovementsService: CashMovementsService, entityManager: EntityManager);
    create(createPaymentDto: CreatePaymentDto, userId: number): Promise<Payment>;
    private generateReceiptNumber;
    findAll(): Promise<Payment[]>;
    findByLoan(loanId: number): Promise<Payment[]>;
    findOne(id: number): Promise<Payment>;
    getPaymentHistory(loanId: number): Promise<{
        payments: Payment[];
        summary: {
            totalPaid: number;
            totalInterest: number;
            totalCapital: number;
            monthsPaid: number;
            remainingBalance: number;
            monthlyPayment: number;
        };
    }>;
    findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]>;
    getOverdueLoans(): Promise<{
        count: number;
        totalAmount: number;
        loans: Loan[];
    }>;
    remove(id: number): Promise<void>;
}
