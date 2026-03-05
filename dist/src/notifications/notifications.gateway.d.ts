import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { ActivityLog } from '../activity/entities/activity-log.entity';
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    private activityLogRepo;
    server: Server;
    private connectedUsers;
    constructor(jwtService: JwtService, activityLogRepo: Repository<ActivityLog>);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleNavigated(client: Socket, data: {
        page: string;
    }): void;
    handleUpdateLocation(client: Socket, data: {
        lat: number;
        lng: number;
        accuracy: number;
    }): void;
    getOnlineUsers(): {
        userId: number;
        username: string;
        fullName: string;
        role: string;
        currentPage: string;
        connectedSince: Date;
        lastActivity: Date;
        hasGps: boolean;
        profilePhoto: string | undefined;
    }[];
    getBrowserLocation(userId: number): {
        lat: number;
        lng: number;
    } | undefined;
    emitPresenceUpdate(): void;
    emitActivity(log: any): void;
    emitNewLoan(loan: any): void;
    emitNewPayment(payment: any): void;
    emitDashboardUpdate(data: any): void;
    private patchRecentLoginLocation;
}
