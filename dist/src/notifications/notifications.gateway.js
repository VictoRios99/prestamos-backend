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
exports.NotificationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
let NotificationsGateway = class NotificationsGateway {
    jwtService;
    server;
    connectedUsers = new Map();
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token);
            const bl = client.handshake.auth?.browserLocation;
            const pp = client.handshake.auth?.profilePhoto;
            const user = {
                socketId: client.id,
                userId: payload.sub,
                username: payload.username,
                fullName: payload.fullName || payload.username,
                role: payload.role,
                currentPage: '/',
                connectedSince: new Date(),
                lastActivity: new Date(),
                browserLocation: bl && typeof bl.lat === 'number' ? bl : undefined,
                profilePhoto: typeof pp === 'string' ? pp : undefined,
            };
            this.connectedUsers.set(client.id, user);
            this.emitPresenceUpdate();
        }
        catch {
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.connectedUsers.delete(client.id);
        this.emitPresenceUpdate();
    }
    handleNavigated(client, data) {
        const user = this.connectedUsers.get(client.id);
        if (user) {
            user.currentPage = data.page;
            user.lastActivity = new Date();
            this.emitPresenceUpdate();
        }
    }
    getOnlineUsers() {
        const seen = new Map();
        for (const u of this.connectedUsers.values()) {
            if (u.role === 'SUPER_ADMIN')
                continue;
            const existing = seen.get(u.userId);
            if (!existing || u.lastActivity > existing.lastActivity) {
                seen.set(u.userId, u);
            }
        }
        return Array.from(seen.values()).map((u) => ({
            userId: u.userId,
            username: u.username,
            fullName: u.fullName,
            role: u.role,
            currentPage: u.currentPage,
            connectedSince: u.connectedSince,
            lastActivity: u.lastActivity,
            hasGps: !!u.browserLocation,
            profilePhoto: u.profilePhoto || undefined,
        }));
    }
    getBrowserLocation(userId) {
        for (const u of this.connectedUsers.values()) {
            if (u.userId === userId && u.browserLocation) {
                return { lat: u.browserLocation.lat, lng: u.browserLocation.lng };
            }
        }
        return undefined;
    }
    emitPresenceUpdate() {
        this.server.emit('userPresence', this.getOnlineUsers());
    }
    emitActivity(log) {
        this.server.emit('activityLogged', {
            id: log.id,
            action: log.action,
            userName: log.userName,
            entityType: log.entityType,
            entityId: log.entityId,
            details: log.details,
            createdAt: log.createdAt,
        });
    }
    emitNewLoan(loan) {
        this.server.emit('newLoan', {
            message: 'Nuevo prestamo creado',
            loan,
            timestamp: new Date(),
        });
    }
    emitNewPayment(payment) {
        this.server.emit('newPayment', {
            message: 'Nuevo pago registrado',
            payment,
            timestamp: new Date(),
        });
    }
    emitDashboardUpdate(data) {
        this.server.emit('dashboardUpdate', data);
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('navigated'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], NotificationsGateway.prototype, "handleNavigated", null);
exports.NotificationsGateway = NotificationsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: [
                'http://localhost:4200',
                'http://127.0.0.1:4200',
                'https://panel-prestamos.itcooper.mx',
            ],
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map