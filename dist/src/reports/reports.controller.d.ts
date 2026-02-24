import { Response, Request } from 'express';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { ExcelExportService } from './excel-export.service';
import { ActivityService } from '../activity/activity.service';
export declare class ReportsController {
    private readonly loansService;
    private readonly paymentsService;
    private readonly excelExportService;
    private readonly activityService;
    constructor(loansService: LoansService, paymentsService: PaymentsService, excelExportService: ExcelExportService, activityService: ActivityService);
    exportLoans(res: Response, req: Request): Promise<void>;
    exportPayments(res: Response, req: Request, startDate?: string, endDate?: string, reportType?: 'past' | 'all'): Promise<void>;
    exportOverdueLoans(res: Response, req: Request): Promise<void>;
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
