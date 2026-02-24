"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const user_entity_1 = require("./users/entities/user.entity");
const customer_entity_1 = require("./customers/entities/customer.entity");
const loan_entity_1 = require("./loans/entities/loan.entity");
const monthly_payment_entity_1 = require("./loans/entities/monthly-payment.entity");
const payment_entity_1 = require("./payments/entities/payment.entity");
const cash_movement_entity_1 = require("./cash-movements/entities/cash-movement.entity");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const customers_module_1 = require("./customers/customers.module");
const loans_module_1 = require("./loans/loans.module");
const payments_module_1 = require("./payments/payments.module");
const cash_movements_module_1 = require("./cash-movements/cash-movements.module");
const reports_module_1 = require("./reports/reports.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const notifications_module_1 = require("./notifications/notifications.module");
const tasks_module_1 = require("./tasks/tasks.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'static', 'browser'),
                serveRoot: '/',
                exclude: ['/api*', '/uploads*'],
            }, {
                rootPath: (0, path_1.join)(process.cwd(), 'uploads'),
                serveRoot: '/uploads',
            }),
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [{ ttl: 60000, limit: 30 }],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    host: config.get('DB_HOST'),
                    port: parseInt(config.get('DB_PORT') ?? '5432', 10),
                    username: config.get('DB_USERNAME'),
                    password: config.get('DB_PASSWORD'),
                    database: config.get('DB_DATABASE'),
                    ssl: config.get('DB_SSL') === 'true'
                        ? { rejectUnauthorized: false }
                        : false,
                    entities: [user_entity_1.User, customer_entity_1.Customer, loan_entity_1.Loan, monthly_payment_entity_1.MonthlyPayment, payment_entity_1.Payment, cash_movement_entity_1.CashMovement],
                    synchronize: false,
                }),
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            customers_module_1.CustomersModule,
            loans_module_1.LoansModule,
            payments_module_1.PaymentsModule,
            cash_movements_module_1.CashMovementsModule,
            reports_module_1.ReportsModule,
            dashboard_module_1.DashboardModule,
            notifications_module_1.NotificationsModule,
            tasks_module_1.TasksModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map