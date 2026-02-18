import { Controller, Get, Res, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { ExcelExportService } from './excel-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly loansService: LoansService,
    private readonly paymentsService: PaymentsService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  @Get('loans/export')
  async exportLoans(@Res() res: Response) {
    try {
      const loans = await this.loansService.findAll();

      // Crear buffer del Excel
      const buffer = await this.generateLoansExcel(loans);

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=prestamos.xlsx',
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error exporting loans:', error);
      res.status(500).json({ error: 'Error al exportar préstamos' });
    }
  }

  @Get('payments/export')
  async exportPayments(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('reportType') reportType?: 'past' | 'all',
  ) {
    try {
      const start: Date | undefined = startDate
        ? new Date(startDate)
        : undefined;
      let end: Date | undefined = endDate
        ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999))
        : undefined;

      if (reportType === 'past' || !reportType) {
        // 'past' is default
        if (!end) {
          end = new Date(new Date().setUTCHours(23, 59, 59, 999)); // End of today
        }
      } else if (reportType === 'all') {
        // If 'all' is requested, and no specific endDate is provided, ensure it's effectively infinite
        // Or, simply pass undefined to excelExportService.exportPayments to get all
        end = undefined; // This will make the service fetch all if start is also undefined
      }

      const buffer = await this.excelExportService.exportPayments(start, end);

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=pagos.xlsx',
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error exporting payments:', error);
      res.status(500).json({ error: 'Error al exportar pagos' });
    }
  }

  @Get('dashboard')
  async getDashboardReport() {
    try {
      const loans = await this.loansService.findAll();
      const payments = await this.paymentsService.findAll();

      // Calcular métricas básicas para el reporte
      const totalLoaned = loans.reduce(
        (sum, loan) => sum + Number(loan.amount),
        0,
      );
      const totalPaid = payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );

      return {
        totalLoans: loans.length,
        totalLoaned,
        totalPaid,
        activeLoans: loans.filter((l) => l.status === 'ACTIVE').length,
        completedLoans: loans.filter((l) => l.status === 'PAID').length,
      };
    } catch (error) {
      console.error('Error generating dashboard report:', error);
      throw error;
    }
  }

  private async generateLoansExcel(loans: any[]): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    // Configurar metadatos
    workbook.creator = 'Sistema de Préstamos';
    workbook.created = new Date();

    // Crear hoja principal
    const worksheet = workbook.addWorksheet('Préstamos');

    // Configurar columnas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Cliente', key: 'customer', width: 25 },
      { header: 'Fecha Préstamo', key: 'loanDate', width: 15 },
      { header: 'Monto Original', key: 'amount', width: 15 },
      { header: 'Saldo Actual', key: 'currentBalance', width: 15 },
      { header: 'Total Interés Pagado', key: 'totalInterestPaid', width: 18 },
      { header: 'Total Capital Pagado', key: 'totalCapitalPaid', width: 18 },
      { header: 'Quincenas Pagadas', key: 'monthsPaid', width: 15 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Último Pago', key: 'lastPaymentDate', width: 15 },
    ];

    // Estilo de encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Agregar datos
    loans.forEach((loan) => {
      const row = worksheet.addRow({
        id: loan.id,
        customer: loan.customer
          ? `${loan.customer.firstName} ${loan.customer.lastName}`
          : 'N/A',
        loanDate: loan.loanDate,
        amount: Number(loan.amount),
        currentBalance: Number(loan.currentBalance || 0),
        totalInterestPaid: Number(loan.totalInterestPaid || 0),
        totalCapitalPaid: Number(loan.totalCapitalPaid || 0),
        monthsPaid: loan.monthsPaid || 0,
        status: this.getStatusText(loan.status),
        lastPaymentDate: loan.lastPaymentDate || 'Sin pagos',
      });

      // Formato de números como moneda
      [
        'amount',
        'currentBalance',
        'totalInterestPaid',
        'totalCapitalPaid',
      ].forEach((col) => {
        const cell = row.getCell(col);
        cell.numFmt = '"$"#,##0.00';
      });

      // Formato de fecha
      if (loan.loanDate) {
        row.getCell('loanDate').numFmt = 'dd/mm/yyyy';
      }
      if (loan.lastPaymentDate) {
        row.getCell('lastPaymentDate').numFmt = 'dd/mm/yyyy';
      }
    });

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  private getStatusText(status: string): string {
    const statusMap = {
      ACTIVE: 'Activo',
      PAID: 'Pagado',
      OVERDUE: 'Vencido',
      CANCELLED: 'Cancelado',
    };
    return statusMap[status] || status;
  }
}
