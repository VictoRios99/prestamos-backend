// src/tasks/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private loansService: LoansService) {}

  // Ejecutar todos los días a las 9 AM
  @Cron('0 9 * * *')
  async checkOverdueLoans() {
    this.logger.log('Checking for overdue loans...');
    const result = await this.loansService.updateOverdueStatuses();
    this.logger.log(`Overdue check complete: ${result.markedOverdue} marked overdue, ${result.restoredActive} restored to active`);
  }

  // Ejecutar el primer día de cada mes
  @Cron('0 0 1 * *')
  async generateMonthlyReport() {
    this.logger.log('Generating monthly report...');
    // Lógica para generar reporte mensual
  }
}
