// src/tasks/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private loansService: LoansService) {}

  // Ejecutar todos los días a las 9 AM
  @Cron('0 9 * * *')
  async checkOverdueLoans() {
    this.logger.log('Checking for overdue loans...');
    const overdueLoans = await this.loansService.findOverdueLoans();
    
    // Aquí puedes enviar notificaciones, emails, etc.
    overdueLoans.forEach(loan => {
      this.logger.warn(`Loan #${loan.id} is overdue`);
    });
  }

  // Ejecutar el primer día de cada mes
  @Cron('0 0 1 * *')
  async generateMonthlyReport() {
    this.logger.log('Generating monthly report...');
    // Lógica para generar reporte mensual
  }
}