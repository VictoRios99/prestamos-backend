export declare class CreateLoanDto {
    customerId: number;
    loanDate: string;
    amount: number;
    notes?: string;
    monthlyInterestRate?: string;
    term?: number;
    modality?: string;
    loanType?: string;
    totalToPay?: number;
}
