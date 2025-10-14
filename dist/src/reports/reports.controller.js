"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const loans_service_1 = require("../loans/loans.service");
const payments_service_1 = require("../payments/payments.service");
const excel_export_service_1 = require("./excel-export.service");
let ReportsController = class ReportsController {
    loansService;
    paymentsService;
    excelExportService;
    constructor(loansService, paymentsService, excelExportService) {
        this.loansService = loansService;
        this.paymentsService = paymentsService;
        this.excelExportService = excelExportService;
    }
    async exportLoans(res) {
        try {
            const loans = await this.loansService.findAll();
            const buffer = await this.generateLoansExcel(loans);
            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=prestamos.xlsx',
                'Content-Length': buffer.length,
            });
            res.send(buffer);
        }
        catch (error) {
            console.error('Error exporting loans:', error);
            res.status(500).json({ error: 'Error al exportar préstamos' });
        }
    }
    async exportPayments(res, startDate, endDate, reportType) {
        try {
            const start = startDate
                ? new Date(startDate)
                : undefined;
            let end = endDate
                ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999))
                : undefined;
            if (reportType === 'past' || !reportType) {
                if (!end) {
                    end = new Date(new Date().setUTCHours(23, 59, 59, 999));
                }
            }
            else if (reportType === 'all') {
                end = undefined;
            }
            const buffer = await this.excelExportService.exportPayments(start, end);
            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=pagos.xlsx',
                'Content-Length': buffer.length,
            });
            res.send(buffer);
        }
        catch (error) {
            console.error('Error exporting payments:', error);
            res.status(500).json({ error: 'Error al exportar pagos' });
        }
    }
    async getDashboardReport() {
        try {
            const loans = await this.loansService.findAll();
            const payments = await this.paymentsService.findAll();
            const totalLoaned = loans.reduce((sum, loan) => sum + Number(loan.amount), 0);
            const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            return {
                totalLoans: loans.length,
                totalLoaned,
                totalPaid,
                activeLoans: loans.filter((l) => l.status === 'ACTIVE').length,
                completedLoans: loans.filter((l) => l.status === 'PAID').length,
            };
        }
        catch (error) {
            console.error('Error generating dashboard report:', error);
            throw error;
        }
    }
    async generateLoansExcel(loans) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Préstamos';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Préstamos');
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
        return buffer;
    }
    getStatusText(status) {
        const statusMap = {
            ACTIVE: 'Activo',
            PAID: 'Pagado',
            OVERDUE: 'Vencido',
            CANCELLED: 'Cancelado',
        };
        return statusMap[status] || status;
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('loans/export'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportLoans", null);
__decorate([
    (0, common_1.Get)('payments/export'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('reportType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportPayments", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDashboardReport", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [loans_service_1.LoansService,
        payments_service_1.PaymentsService,
        excel_export_service_1.ExcelExportService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map