// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { LoansModule } from '../loans/loans.module';

@Module({
  imports: [ScheduleModule.forRoot(), LoansModule],
  providers: [TasksService],
})
export class TasksModule {}
