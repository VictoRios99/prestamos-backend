import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Request } from 'express';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
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
    remove(id: string): Promise<void>;
}
