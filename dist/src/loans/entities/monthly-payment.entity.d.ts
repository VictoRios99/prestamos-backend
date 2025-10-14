import { Loan } from './loan.entity';
export declare class MonthlyPayment {
    id: number;
    loan: Loan;
    dueDate: Date;
    expectedAmount: number;
    paidAmount: number;
    interestPaid: number;
    capitalPaid: number;
    isPaid: boolean;
    paymentDate: Date;
    createdAt: Date;
}
