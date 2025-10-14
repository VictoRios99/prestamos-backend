import { Repository, EntityManager } from 'typeorm';
import { Loan } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
export declare class LoansService {
    private loansRepository;
    private monthlyPaymentRepository;
    private readonly cashMovementsService;
    private readonly entityManager;
    constructor(loansRepository: Repository<Loan>, monthlyPaymentRepository: Repository<MonthlyPayment>, cashMovementsService: CashMovementsService, entityManager: EntityManager);
    create(createLoanDto: CreateLoanDto, userId: number): Promise<Loan>;
    findOne(id: number, manager?: EntityManager): Promise<Loan>;
    findByCustomer(customerId: number): Promise<Loan[]>;
    remove(id: number): Promise<void>;
    private createMonthlyPayment;
    findAll(): Promise<Loan[]>;
    getLoanDetails(loanId: number): Promise<any>;
    findOverdueLoans(): Promise<{
        count: number;
        totalAmount: number;
        loans: Loan[];
    }>;
    getCompletedLoans(): Promise<Loan[]>;
    getDashboardStats(): Promise<any>;
}
