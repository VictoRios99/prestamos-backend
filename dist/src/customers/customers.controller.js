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
exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const customers_service_1 = require("./customers.service");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const update_customer_dto_1 = require("./dto/update-customer.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../users/entities/user.entity");
const activity_service_1 = require("../activity/activity.service");
const activity_log_entity_1 = require("../activity/entities/activity-log.entity");
const get_client_ip_1 = require("../common/utils/get-client-ip");
let CustomersController = class CustomersController {
    customersService;
    activityService;
    constructor(customersService, activityService) {
        this.customersService = customersService;
        this.activityService = activityService;
    }
    async create(createCustomerDto, req) {
        const user = req.user;
        const customer = await this.customersService.create(createCustomerDto, user.userId);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.CREATE_CUSTOMER,
            userId: user.userId,
            userName: user.fullName || user.username,
            entityType: 'customer',
            entityId: customer.id,
            details: { name: `${createCustomerDto.firstName} ${createCustomerDto.lastName}` },
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return customer;
    }
    findAll() {
        return this.customersService.findAll();
    }
    findOne(id) {
        return this.customersService.findOne(+id);
    }
    async update(id, updateCustomerDto, req) {
        const user = req.user;
        const result = await this.customersService.update(+id, updateCustomerDto);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.UPDATE_CUSTOMER,
            userId: user.userId,
            userName: user.fullName || user.username,
            entityType: 'customer',
            entityId: +id,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return result;
    }
    async remove(id, req) {
        const user = req.user;
        const result = await this.customersService.remove(+id);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.DELETE_CUSTOMER,
            userId: user.userId,
            userName: user.fullName || user.username,
            entityType: 'customer',
            entityId: +id,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return result;
    }
    async bulkUpload(file) {
        if (!file) {
            throw new common_1.BadRequestException('No se ha proporcionado ningun archivo');
        }
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
            throw new common_1.BadRequestException('Formato de archivo invalido. Solo se permiten archivos Excel (.xlsx, .xls)');
        }
        return this.customersService.bulkUpload(file.buffer);
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.OPERATOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_customer_dto_1.CreateCustomerDto, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.OPERATOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_customer_dto_1.UpdateCustomerDto, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk-upload'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPER_ADMIN, user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.OPERATOR),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "bulkUpload", null);
exports.CustomersController = CustomersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('customers'),
    __metadata("design:paramtypes", [customers_service_1.CustomersService,
        activity_service_1.ActivityService])
], CustomersController);
//# sourceMappingURL=customers.controller.js.map