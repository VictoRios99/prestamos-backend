export declare class CreatePaymentDto {
    loanId: number;
    paymentDate: string;
    amount?: number;
    capitalAmount?: number;
    interestAmount?: number;
    paymentMethod?: string;
    notes?: string;
    overduePeriodsPaid?: number;
    lateInterest?: number;
}
