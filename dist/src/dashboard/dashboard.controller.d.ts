import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getDashboardStats(): Promise<import("./dashboard.service").DashboardStats>;
    getCapitalDistribution(): Promise<import("./dashboard.service").CapitalDistributionEntry[]>;
    getPaymentActivityLog(month?: string, year?: string): Promise<import("./dashboard.service").PaymentLogEntry[]>;
    getLoansWithPaymentStatus(): Promise<any[]>;
}
