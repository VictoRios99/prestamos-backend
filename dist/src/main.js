"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const config_1 = require("@nestjs/config");
const class_validator_1 = require("class-validator");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
const helmet_1 = require("helmet");
const fs_1 = require("fs");
const path_1 = require("path");
async function bootstrap() {
    const uploadsDir = (0, path_1.join)(process.cwd(), 'uploads', 'profiles');
    if (!(0, fs_1.existsSync)(uploadsDir)) {
        (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: false });
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    (0, class_validator_1.useContainer)(app.select(app_module_1.AppModule), { fallbackOnErrors: true });
    const allowedOrigins = [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
        'https://panel-prestamos.itcooper.mx',
    ];
    const frontendOriginsFromEnv = process.env.FRONTEND_ORIGIN;
    if (frontendOriginsFromEnv) {
        const additionalOrigins = frontendOriginsFromEnv.split(',').map(origin => origin.trim());
        allowedOrigins.push(...additionalOrigins);
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.setGlobalPrefix('api');
    const configService = app.get(config_1.ConfigService);
    const portFromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
    const port = portFromEnv ?? configService.get('PORT') ?? 3000;
    await app.listen(port, '127.0.0.1');
    console.log(`Application is running on: http://127.0.0.1:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map