import { LoansService } from '../loans/loans.service';
export declare class TasksService {
    private loansService;
    private readonly logger;
    constructor(loansService: LoansService);
    checkOverdueLoans(): Promise<void>;
    generateMonthlyReport(): Promise<void>;
}
