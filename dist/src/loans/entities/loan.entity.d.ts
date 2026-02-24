import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { MonthlyPayment } from './monthly-payment.entity';
export declare enum LoanStatus {
    ACTIVE = "ACTIVE",
    PAID = "PAID",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare class Loan {
    id: number;
    customer: Customer;
    loanDate: Date;
    amount: number;
    currentBalance: number;
    totalInterestPaid: number;
    totalCapitalPaid: number;
    monthlyInterestRate: string;
    term: number;
    modality: string;
    loanType: string;
    status: LoanStatus;
    displayId: string;
    notes: string;
    monthsPaid: number;
    lastPaymentDate: Date;
    createdBy: User;
    payments: Payment[];
    monthlyPayments: MonthlyPayment[];
    createdAt: Date;
    updatedAt: Date;
    interestRate: number;
    interestAmount: number;
    totalAmount: number;
    paymentFrequency: string;
    termMonths: number;
}
