import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
export declare class LoansController {
    private readonly loansService;
    constructor(loansService: LoansService);
    create(createLoanDto: CreateLoanDto): Promise<import("./entities/loan.entity").Loan>;
    findAll(): Promise<import("./entities/loan.entity").Loan[]>;
    findCompletedLoans(): Promise<import("./entities/loan.entity").Loan[]>;
    findByCustomer(customerId: string): Promise<import("./entities/loan.entity").Loan[]>;
    getBalance(id: string): Promise<any>;
    findById(id: string): Promise<any>;
    remove(id: string): Promise<void>;
}
