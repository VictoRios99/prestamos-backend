import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';
import { ActivityLog } from '../activity/entities/activity-log.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ActivityLog])],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
