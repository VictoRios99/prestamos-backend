"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("./dashboard.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const activity_service_1 = require("../activity/activity.service");
const activity_log_entity_1 = require("../activity/entities/activity-log.entity");
const get_client_ip_1 = require("../common/utils/get-client-ip");
let DashboardController = class DashboardController {
    dashboardService;
    activityService;
    constructor(dashboardService, activityService) {
        this.dashboardService = dashboardService;
        this.activityService = activityService;
    }
    async getDashboardStats(req) {
        const user = req.user;
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.VIEW_DASHBOARD,
            userId: user.userId,
            userName: user.fullName || user.username,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return this.dashboardService.getDashboardStats();
    }
    async getCapitalDistribution() {
        return this.dashboardService.getCapitalDistribution();
    }
    async getPaymentActivityLog(month, year) {
        const now = new Date();
        const m = month ? parseInt(month, 10) : now.getMonth() + 1;
        const y = year ? parseInt(year, 10) : now.getFullYear();
        return this.dashboardService.getPaymentActivityLog(m, y);
    }
    async getLoansWithPaymentStatus() {
        return this.dashboardService.getLoansWithPaymentStatus();
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getDashboardStats", null);
__decorate([
    (0, common_1.Get)('capital-distribution'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getCapitalDistribution", null);
__decorate([
    (0, common_1.Get)('payment-log'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getPaymentActivityLog", null);
__decorate([
    (0, common_1.Get)('loans-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getLoansWithPaymentStatus", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.AUDITOR),
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService,
        activity_service_1.ActivityService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map