import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ActivityService } from '../activity/activity.service';
import { Request } from 'express';
export declare class LoansController {
    private readonly loansService;
    private readonly activityService;
    constructor(loansService: LoansService, activityService: ActivityService);
    create(createLoanDto: CreateLoanDto, req: Request): Promise<import("./entities/loan.entity").Loan>;
    findAll(): Promise<import("./entities/loan.entity").Loan[]>;
    findCompletedLoans(): Promise<import("./entities/loan.entity").Loan[]>;
    findByCustomer(customerId: string): Promise<import("./entities/loan.entity").Loan[]>;
    getBalance(id: string): Promise<any>;
    findById(id: string): Promise<any>;
    remove(id: string, req: Request): Promise<void>;
}
