import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const authToken = client.handshake?.headers?.authorization?.split(' ')[1];
      
      if (!authToken) {
        throw new WsException('Unauthorized');
      }

      const payload = this.jwtService.verify(authToken);
      client.user = payload;
      
      return true;
    } catch (err) {
      throw new WsException('Unauthorized');
    }
  }
}