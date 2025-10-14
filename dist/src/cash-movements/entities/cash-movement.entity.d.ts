import { User } from '../../users/entities/user.entity';
export declare enum MovementType {
    LOAN_OUT = "LOAN_OUT",
    PAYMENT_IN = "PAYMENT_IN",
    EXPENSE = "EXPENSE",
    DEPOSIT = "DEPOSIT"
}
export declare class CashMovement {
    id: number;
    movementDate: Date;
    movementType: MovementType;
    amount: number;
    balanceAfter: number;
    referenceType: string;
    referenceId: number;
    description: string;
    createdBy: User;
    createdAt: Date;
}
