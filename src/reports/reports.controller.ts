import { Controller, Get, Res, Query, UseGuards, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { ExcelExportService } from './excel-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly loansService: LoansService,
    private readonly paymentsService: PaymentsService,
    private readonly excelExportService: ExcelExportService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('loans/export')
  async exportLoans(@Res() res: Response, @Req() req: Request) {
    try {
      const loans = await this.loansService.findAll();
      const buffer = await this.generateLoansExcel(loans);

      const user = req.user as any;
      this.activityService.log({
        action: ActivityAction.EXPORT_REPORT,
        userId: user.userId,
        userName: user.fullName || user.username,
        details: { report: 'prestamos' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=prestamos.xlsx',
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error exporting loans:', error);
      res.status(500).json({ error: 'Error al exportar prestamos' });
    }
  }

  @Get('payments/export')
  async exportPayments(
    @Res() res: Response,
    @Req() req: Request,
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
        if (!end) {
          end = new Date(new Date().setUTCHours(23, 59, 59, 999));
        }
      } else if (reportType === 'all') {
        end = undefined;
      }

      const buffer = await this.excelExportService.exportPayments(start, end);

      const user = req.user as any;
      this.activityService.log({
        action: ActivityAction.EXPORT_REPORT,
        userId: user.userId,
        userName: user.fullName || user.username,
        details: { report: 'pagos', startDate, endDate, reportType },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

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

  @Get('overdue/export')
  async exportOverdueLoans(@Res() res: Response, @Req() req: Request) {
    try {
      const buffer = await this.excelExportService.exportOverdueLoans();

      const user = req.user as any;
      this.activityService.log({
        action: ActivityAction.EXPORT_REPORT,
        userId: user.userId,
        userName: user.fullName || user.username,
        details: { report: 'prestamos-vencidos' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=prestamos-vencidos.xlsx',
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error exporting overdue loans:', error);
      res.status(500).json({ error: 'Error al exportar prestamos vencidos' });
    }
  }

  @Get('dashboard')
  async getDashboardReport() {
    try {
      const loans = await this.loansService.findAll();
      const payments = await this.paymentsService.findAll();

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

    workbook.creator = 'Sistema de Prestamos';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Prestamos');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Cliente', key: 'customer', width: 25 },
      { header: 'Fecha Prestamo', key: 'loanDate', width: 15 },
      { header: 'Monto Original', key: 'amount', width: 15 },
      { header: 'Saldo Actual', key: 'currentBalance', width: 15 },
      { header: 'Total Interes Pagado', key: 'totalInterestPaid', width: 18 },
      { header: 'Total Capital Pagado', key: 'totalCapitalPaid', width: 18 },
      { header: 'Quincenas Pagadas', key: 'monthsPaid', width: 15 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Ultimo Pago', key: 'lastPaymentDate', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

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

      [
        'amount',
        'currentBalance',
        'totalInterestPaid',
        'totalCapitalPaid',
      ].forEach((col) => {
        const cell = row.getCell(col);
        cell.numFmt = '"$"#,##0.00';
      });

      if (loan.loanDate) {
        row.getCell('loanDate').numFmt = 'dd/mm/yyyy';
      }
      if (loan.lastPaymentDate) {
        row.getCell('lastPaymentDate').numFmt = 'dd/mm/yyyy';
      }
    });

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
