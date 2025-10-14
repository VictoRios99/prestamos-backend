import { User } from '../../users/entities/user.entity';
import { Loan } from '../../loans/entities/loan.entity';
export declare class Customer {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
    isActive: boolean;
    createdBy: User;
    loans: Loan[];
    createdAt: Date;
    updatedAt: Date;
}
