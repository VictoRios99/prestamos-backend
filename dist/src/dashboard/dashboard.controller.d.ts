import { DashboardService } from './dashboard.service';
import { ActivityService } from '../activity/activity.service';
import { Request } from 'express';
export declare class DashboardController {
    private readonly dashboardService;
    private readonly activityService;
    constructor(dashboardService: DashboardService, activityService: ActivityService);
    getDashboardStats(req: Request): Promise<import("./dashboard.service").DashboardStats>;
    getCapitalDistribution(): Promise<import("./dashboard.service").CapitalDistributionEntry[]>;
    getPaymentActivityLog(month?: string, year?: string): Promise<import("./dashboard.service").PaymentLogEntry[]>;
    getLoansWithPaymentStatus(): Promise<any[]>;
}
