import { Loan } from '../../loans/entities/loan.entity';
import { User } from '../../users/entities/user.entity';
export declare enum PaymentType {
    CAPITAL = "CAPITAL",
    INTEREST = "INTEREST",
    BOTH = "BOTH"
}
export declare class Payment {
    id: number;
    loan: Loan;
    paymentDate: Date;
    amount: number;
    paymentType: PaymentType;
    paymentMethod: string;
    receiptNumber: string;
    notes: string;
    interestPaid: number;
    capitalPaid: number;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
