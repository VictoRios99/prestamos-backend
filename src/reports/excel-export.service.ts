import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { Loan } from '../loans/entities/loan.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelExportService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
  ) {}

  async exportPayments(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Configurar metadatos
    workbook.creator = 'Sistema de Préstamos';
    workbook.created = new Date();

    // Crear hoja de pagos
    const paymentsSheet = workbook.addWorksheet('Pagos');
    await this.createPaymentsSheet(paymentsSheet, startDate, endDate);

    // Crear hoja de resumen
    const summarySheet = workbook.addWorksheet('Resumen');
    await this.createSummarySheet(summarySheet, startDate, endDate);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private async createPaymentsSheet(
    sheet: ExcelJS.Worksheet,
    startDate?: Date,
    endDate?: Date,
  ) {
    // Configurar encabezados
    sheet.columns = [
      { header: 'ID Pago', key: 'paymentId', width: 10 },
      { header: 'Fecha', key: 'paymentDate', width: 12 },
      { header: 'ID Préstamo', key: 'loanId', width: 12 },
      { header: 'Cliente', key: 'customer', width: 25 },
      { header: 'Monto Total', key: 'totalAmount', width: 15 },
      { header: 'Interés Pagado', key: 'interestPaid', width: 15 },
      { header: 'Capital Pagado', key: 'capitalPaid', width: 15 },
      { header: 'Tipo de Pago', key: 'paymentType', width: 12 },
      { header: 'Método', key: 'paymentMethod', width: 12 },
      { header: 'Plazos', key: 'termProgress', width: 15 },
      { header: 'Recibo', key: 'receiptNumber', width: 15 },
      { header: 'Saldo Restante', key: 'remainingBalance', width: 15 },
      { header: 'Notas', key: 'notes', width: 30 },
    ];

    // Estilo de encabezados
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Obtener datos de pagos
    let whereClause = {};
    if (startDate && endDate) {
      whereClause = {
        paymentDate: Between(startDate, endDate),
      };
    }

    const payments = await this.paymentsRepository.find({
      where: whereClause,
      relations: ['loan', 'loan.customer'],
      order: { paymentDate: 'DESC' },
      cache: false, // Deshabilitar caché
    });

    payments.forEach((payment, index) => {
      const row = sheet.addRow({
        paymentId: payment.id,
        paymentDate: payment.paymentDate,
        loanId: payment.loan?.id || 'N/A',
        customer:
          payment.loan && payment.loan.customer
            ? `${payment.loan.customer.firstName} ${payment.loan.customer.lastName}`.trim()
            : 'N/A',
        totalAmount: Number(payment.amount),
        interestPaid: Number(payment.interestPaid || 0),
        capitalPaid: Number(payment.capitalPaid || 0),
        paymentType: this.getPaymentTypeText(payment.paymentType),
        paymentMethod: payment.paymentMethod,
        receiptNumber: payment.receiptNumber,
        termProgress: payment.loan?.term
          ? `${(payment.loan.monthsPaid || 0) * 2}/${payment.loan.term * 2} quincenas`
          : '',
        remainingBalance: Number(payment.loan?.currentBalance || 0),
        notes: payment.notes || '',
      });

      // Formato de números como moneda
      [
        'totalAmount',
        'interestPaid',
        'capitalPaid',
        'remainingBalance',
      ].forEach((col) => {
        const cell = row.getCell(col);
        cell.numFmt = '"$"#,##0.00';
      });

      // Formato de fecha
      row.getCell('paymentDate').numFmt = 'dd/mm/yyyy';
    });

    // Agregar fila de totales
    if (payments.length > 0) {
      const totalRow = sheet.addRow({
        paymentId: '',
        paymentDate: '',
        loanId: '',
        customer: 'TOTALES:',
        totalAmount: { formula: `SUM(E2:E${payments.length + 1})` },
        interestPaid: { formula: `SUM(F2:F${payments.length + 1})` },
        capitalPaid: { formula: `SUM(G2:G${payments.length + 1})` },
        paymentType: '',
        paymentMethod: '',
        receiptNumber: '',
        remainingBalance: '',
        notes: '',
      });

      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
    }
  }

  private async createSummarySheet(
    sheet: ExcelJS.Worksheet,
    startDate?: Date,
    endDate?: Date,
  ) {
    sheet.columns = [
      { header: 'Concepto', key: 'concept', width: 30 },
      { header: 'Valor', key: 'value', width: 20 },
    ];

    // Estilo de encabezados
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Calcular estadísticas
    const stats = await this.calculateStats(startDate, endDate);

    // Agregar datos de resumen
    const summaryData = [
      {
        concept: 'Período del Reporte',
        value: this.formatDateRange(startDate, endDate),
      },
      { concept: '', value: '' }, // Línea vacía
      { concept: 'MÉTRICAS GENERALES', value: '' },
      { concept: 'Total de Pagos', value: stats.totalPayments },
      { concept: 'Monto Total Recibido', value: stats.totalAmount },
      { concept: 'Total Intereses Cobrados', value: stats.totalInterest },
      { concept: 'Total Capital Recuperado', value: stats.totalCapital },
      { concept: '', value: '' }, // Línea vacía
      { concept: 'ESTADO DE PRÉSTAMOS', value: '' },
      { concept: 'Préstamos Activos', value: stats.activeLoans },
      { concept: 'Préstamos Completados', value: stats.completedLoans },
      { concept: 'Préstamos Vencidos', value: stats.overdueLoans },
      { concept: 'Capital en Tránsito', value: stats.capitalInTransit },
      { concept: '', value: '' }, // Línea vacía
      { concept: 'RENDIMIENTO', value: '' },
      { concept: 'Promedio por Pago', value: stats.averagePayment },
      { concept: 'Interés Mensual Promedio', value: stats.monthlyInterestRate },
    ];

    summaryData.forEach((item, index) => {
      const row = sheet.addRow(item);

      // Formato para títulos de sección
      if (
        item.concept.includes('MÉTRICAS') ||
        item.concept.includes('ESTADO') ||
        item.concept.includes('RENDIMIENTO')
      ) {
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      }

      // Formato de moneda para valores monetarios
      if (
        typeof item.value === 'number' &&
        (item.concept.includes('Monto') ||
          item.concept.includes('Intereses') ||
          item.concept.includes('Capital') ||
          item.concept.includes('Promedio'))
      ) {
        row.getCell('value').numFmt = '"$"#,##0.00';
      }
    });
  }

  private async calculateStats(startDate?: Date, endDate?: Date) {
    // Obtener pagos del período
    let whereClause = {};
    if (startDate && endDate) {
      whereClause = { paymentDate: Between(startDate, endDate) };
    }

    const payments = await this.paymentsRepository.find({
      where: whereClause,
      relations: ['loan', 'loan.customer'],
      cache: false,
    });
    const allLoans = await this.loansRepository.find();

    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalInterest = payments.reduce(
      (sum, p) => sum + (p.interestPaid || 0),
      0,
    );
    const totalCapital = payments.reduce(
      (sum, p) => sum + (p.capitalPaid || 0),
      0,
    );

    const activeLoans = allLoans.filter((l) => l.status === 'ACTIVE').length;
    const completedLoans = allLoans.filter((l) => l.status === 'PAID').length;
    const overdueLoans = allLoans.filter((l) => l.status === 'OVERDUE').length;
    const capitalInTransit = allLoans
      .filter((l) => l.status === 'ACTIVE')
      .reduce((sum, l) => sum + (l.currentBalance || 0), 0);

    return {
      totalPayments,
      totalAmount,
      totalInterest,
      totalCapital,
      activeLoans,
      completedLoans,
      overdueLoans,
      capitalInTransit,
      averagePayment:
        totalPayments > 0 ? Math.ceil(totalAmount / totalPayments) : 0,
      monthlyInterestRate:
        totalAmount > 0 ? Math.ceil((totalInterest / totalAmount) * 100) : 0,
    };
  }

  async exportOverdueLoans(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Préstamos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Préstamos Vencidos');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Cliente', key: 'customer', width: 28 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Tipo', key: 'loanType', width: 12 },
      { header: 'Monto Original', key: 'amount', width: 16 },
      { header: 'Saldo Actual', key: 'currentBalance', width: 16 },
      { header: 'Capital Pagado', key: 'totalCapitalPaid', width: 16 },
      { header: 'Interés Pagado', key: 'totalInterestPaid', width: 16 },
      { header: 'Fecha Préstamo', key: 'loanDate', width: 14 },
      { header: 'Último Pago', key: 'lastPaymentDate', width: 14 },
      { header: 'Días sin Pagar', key: 'daysSincePayment', width: 14 },
      { header: 'Meses de Deuda', key: 'monthsOverdue', width: 14 },
    ];

    // Estilo de encabezados
    const headerRow = sheet.getRow(1);
    headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC0392B' },
    };

    // Obtener préstamos activos y vencidos (misma lógica que dashboard)
    const allLoans = await this.loansRepository.find({
      where: [{ status: 'ACTIVE' as any }, { status: 'OVERDUE' as any }],
      relations: ['customer'],
      order: { lastPaymentDate: 'ASC' },
    });

    const now = new Date();

    // Filtrar: incluir OVERDUE + ACTIVE con más de 30 días sin pagar
    const loans = allLoans.filter((loan) => {
      if ((loan.status as string) === 'OVERDUE') return true;
      const refDate = loan.lastPaymentDate
        ? new Date(loan.lastPaymentDate)
        : new Date(loan.loanDate);
      const diffMs = Math.abs(now.getTime() - refDate.getTime());
      const daysSince = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return daysSince > 30;
    });

    loans.forEach((loan) => {
      const lastDate = loan.lastPaymentDate
        ? new Date(loan.lastPaymentDate)
        : new Date(loan.loanDate);
      const diffMs = Math.abs(now.getTime() - lastDate.getTime());
      const daysSince = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diasAtraso = Math.max(0, daysSince - 30);
      const mesesDeuda = Math.max(1, Math.ceil(diasAtraso / 30));

      const row = sheet.addRow({
        id: loan.id,
        customer: loan.customer
          ? `${loan.customer.firstName} ${loan.customer.lastName}`
          : 'N/A',
        phone: loan.customer?.phone || '',
        loanType: loan.loanType || '',
        amount: Number(loan.amount),
        currentBalance: Number(loan.currentBalance || 0),
        totalCapitalPaid: Number(loan.totalCapitalPaid || 0),
        totalInterestPaid: Number(loan.totalInterestPaid || 0),
        loanDate: loan.loanDate,
        lastPaymentDate: loan.lastPaymentDate || 'Sin pagos',
        daysSincePayment: diasAtraso,
        monthsOverdue: mesesDeuda,
      });

      ['amount', 'currentBalance', 'totalCapitalPaid', 'totalInterestPaid'].forEach((col) => {
        row.getCell(col).numFmt = '"$"#,##0';
      });

      if (loan.loanDate) row.getCell('loanDate').numFmt = 'dd/mm/yyyy';
      if (loan.lastPaymentDate) row.getCell('lastPaymentDate').numFmt = 'dd/mm/yyyy';
    });

    // Fila de totales
    if (loans.length > 0) {
      const lastDataRow = loans.length + 1;
      const totalRow = sheet.addRow({
        id: '',
        customer: `TOTAL: ${loans.length} préstamos vencidos`,
        phone: '',
        loanType: '',
        amount: { formula: `SUM(E2:E${lastDataRow})` },
        currentBalance: { formula: `SUM(F2:F${lastDataRow})` },
        totalCapitalPaid: { formula: `SUM(G2:G${lastDataRow})` },
        totalInterestPaid: { formula: `SUM(H2:H${lastDataRow})` },
        loanDate: '',
        lastPaymentDate: '',
        daysSincePayment: '',
        monthsOverdue: '',
      });

      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private getPaymentTypeText(paymentType: string): string {
    const types = {
      INTEREST: 'Solo Interés',
      CAPITAL: 'Solo Capital',
      BOTH: 'Interés + Capital',
    };
    return types[paymentType] || paymentType;
  }

  private formatDateRange(startDate?: Date, endDate?: Date): string {
    if (!startDate || !endDate) {
      return 'Todos los registros';
    }
    return `${startDate.toLocaleDateString('es-MX')} - ${endDate.toLocaleDateString('es-MX')}`;
  }
}
