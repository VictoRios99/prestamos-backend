// src/notifications/notifications.gateway.ts
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { UseGuards } from '@nestjs/common';
  import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
  
  @WebSocketGateway({
    cors: {
      origin: 'http://localhost:4200',
      credentials: true,
    },
  })
  export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private connectedClients = new Map<string, Socket>();
  
    handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
      this.connectedClients.set(client.id, client);
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
      this.connectedClients.delete(client.id);
    }
  
    // Emitir notificación de nuevo préstamo
    emitNewLoan(loan: any) {
      this.server.emit('newLoan', {
        message: 'Nuevo préstamo creado',
        loan,
        timestamp: new Date(),
      });
    }
  
    // Emitir notificación de nuevo pago
    emitNewPayment(payment: any) {
      this.server.emit('newPayment', {
        message: 'Nuevo pago registrado',
        payment,
        timestamp: new Date(),
      });
    }
  
    // Emitir actualización de dashboard
    emitDashboardUpdate(data: any) {
      this.server.emit('dashboardUpdate', data);
    }
  }