"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const typeorm_1 = require("typeorm");
const loan_entity_1 = require("../loans/entities/loan.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
const monthly_payment_entity_1 = require("../loans/entities/monthly-payment.entity");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const dataSource = app.get(typeorm_1.DataSource);
        if (process.env.NODE_ENV === 'production' &&
            process.env.ALLOW_RESET !== 'true') {
            throw new Error('Bloqueado en producción. Exporta ALLOW_RESET=true para permitirlo.');
        }
        const entities = [payment_entity_1.Payment, monthly_payment_entity_1.MonthlyPayment, loan_entity_1.Loan];
        const tableNames = entities
            .map((e) => `"${dataSource.getMetadata(e).tableName}"`)
            .join(', ');
        console.log('🧨 TRUNCATE (CASCADE) →', tableNames);
        await dataSource.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
        console.log('✅ Datos de Préstamos y Pagos eliminados. Los clientes no fueron modificados.');
    }
    catch (err) {
        console.error('❌ Error eliminando datos:', err.message || err);
        process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
main();
//# sourceMappingURL=clear-loans-and-payments.js.map