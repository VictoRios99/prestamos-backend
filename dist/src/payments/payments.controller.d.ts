import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ActivityService } from '../activity/activity.service';
import { Request } from 'express';
export declare class PaymentsController {
    private readonly paymentsService;
    private readonly activityService;
    constructor(paymentsService: PaymentsService, activityService: ActivityService);
    create(createPaymentDto: CreatePaymentDto, req: Request): Promise<import("./entities/payment.entity").Payment>;
    findAll(): Promise<import("./entities/payment.entity").Payment[]>;
    findOne(id: string): Promise<import("./entities/payment.entity").Payment>;
    getPaymentHistory(loanId: string): Promise<{
        payments: import("./entities/payment.entity").Payment[];
        summary: {
            totalPaid: number;
            totalInterest: number;
            totalCapital: number;
            monthsPaid: number;
            remainingBalance: number;
            monthlyPayment: number;
        };
    }>;
    findByLoan(loanId: string): Promise<import("./entities/payment.entity").Payment[]>;
    remove(id: string, req: Request): Promise<void>;
}
