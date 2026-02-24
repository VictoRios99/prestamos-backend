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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const create_payment_dto_1 = require("./dto/create-payment.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const activity_service_1 = require("../activity/activity.service");
const activity_log_entity_1 = require("../activity/entities/activity-log.entity");
const get_client_ip_1 = require("../common/utils/get-client-ip");
let PaymentsController = class PaymentsController {
    paymentsService;
    activityService;
    constructor(paymentsService, activityService) {
        this.paymentsService = paymentsService;
        this.activityService = activityService;
    }
    async create(createPaymentDto, req) {
        const user = req.user;
        const payment = await this.paymentsService.create(createPaymentDto, user.userId);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.CREATE_PAYMENT,
            userId: user.userId,
            userName: user.fullName || user.username,
            entityType: 'payment',
            entityId: payment.id,
            details: { amount: createPaymentDto.amount, loanId: createPaymentDto.loanId },
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return payment;
    }
    findAll() {
        return this.paymentsService.findAll();
    }
    findOne(id) {
        return this.paymentsService.findOne(+id);
    }
    getPaymentHistory(loanId) {
        return this.paymentsService.getPaymentHistory(+loanId);
    }
    findByLoan(loanId) {
        return this.paymentsService.findByLoan(+loanId);
    }
    async remove(id, req) {
        const user = req.user;
        const result = await this.paymentsService.remove(+id);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.DELETE_PAYMENT,
            userId: user.userId,
            userName: user.fullName || user.username,
            entityType: 'payment',
            entityId: +id,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return result;
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.OPERATOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_payment_dto_1.CreatePaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('history/:loanId'),
    __param(0, (0, common_1.Param)('loanId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getPaymentHistory", null);
__decorate([
    (0, common_1.Get)('loan/:loanId'),
    __param(0, (0, common_1.Param)('loanId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "findByLoan", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "remove", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        activity_service_1.ActivityService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map