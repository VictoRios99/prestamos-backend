import { Response } from 'express';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { ExcelExportService } from './excel-export.service';
export declare class ReportsController {
    private readonly loansService;
    private readonly paymentsService;
    private readonly excelExportService;
    constructor(loansService: LoansService, paymentsService: PaymentsService, excelExportService: ExcelExportService);
    exportLoans(res: Response): Promise<void>;
    exportPayments(res: Response, startDate?: string, endDate?: string, reportType?: 'past' | 'all'): Promise<void>;
    getDashboardReport(): Promise<{
        totalLoans: number;
        totalLoaned: number;
        totalPaid: number;
        activeLoans: number;
        completedLoans: number;
    }>;
    private generateLoansExcel;
    private getStatusText;
}
