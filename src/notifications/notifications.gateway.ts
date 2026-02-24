import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

interface ConnectedUser {
  socketId: string;
  userId: number;
  username: string;
  fullName: string;
  role: string;
  currentPage: string;
  connectedSince: Date;
  lastActivity: Date;
  browserLocation?: { lat: number; lng: number; accuracy: number };
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://panel-prestamos.itcooper.mx',
    ],
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, ConnectedUser>();

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      const bl = client.handshake.auth?.browserLocation;
      const user: ConnectedUser = {
        socketId: client.id,
        userId: payload.sub,
        username: payload.username,
        fullName: payload.fullName || payload.username,
        role: payload.role,
        currentPage: '/',
        connectedSince: new Date(),
        lastActivity: new Date(),
        browserLocation: bl && typeof bl.lat === 'number' ? bl : undefined,
      };
      this.connectedUsers.set(client.id, user);
      this.emitPresenceUpdate();
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.emitPresenceUpdate();
  }

  @SubscribeMessage('navigated')
  handleNavigated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { page: string },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      user.currentPage = data.page;
      user.lastActivity = new Date();
      this.emitPresenceUpdate();
    }
  }

  getOnlineUsers() {
    const seen = new Map<number, ConnectedUser>();
    for (const u of this.connectedUsers.values()) {
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
    }));
  }

  getBrowserLocation(userId: number): { lat: number; lng: number } | undefined {
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

  emitActivity(log: any) {
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

  // Emitir notificacion de nuevo prestamo
  emitNewLoan(loan: any) {
    this.server.emit('newLoan', {
      message: 'Nuevo prestamo creado',
      loan,
      timestamp: new Date(),
    });
  }

  // Emitir notificacion de nuevo pago
  emitNewPayment(payment: any) {
    this.server.emit('newPayment', {
      message: 'Nuevo pago registrado',
      payment,
      timestamp: new Date(),
    });
  }

  // Emitir actualizacion de dashboard
  emitDashboardUpdate(data: any) {
    this.server.emit('dashboardUpdate', data);
  }
}
