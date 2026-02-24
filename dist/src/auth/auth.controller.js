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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const throttler_1 = require("@nestjs/throttler");
const activity_service_1 = require("../activity/activity.service");
const activity_log_entity_1 = require("../activity/entities/activity-log.entity");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const get_client_ip_1 = require("../common/utils/get-client-ip");
let AuthController = class AuthController {
    authService;
    activityService;
    constructor(authService, activityService) {
        this.authService = authService;
        this.activityService = activityService;
    }
    async login(loginDto, req) {
        const result = await this.authService.login(loginDto.username, loginDto.password);
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.LOGIN,
            userId: result.user.id,
            userName: result.user.fullName,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return result;
    }
    async logout(req) {
        const user = req.user;
        this.activityService.log({
            action: activity_log_entity_1.ActivityAction.LOGOUT,
            userId: user.userId,
            userName: user.fullName || user.username,
            ipAddress: (0, get_client_ip_1.getClientIp)(req),
            userAgent: req.headers['user-agent'],
        });
        return { message: 'Sesion cerrada' };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, throttler_1.Throttle)({ default: { ttl: 60000, limit: 5 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        activity_service_1.ActivityService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map