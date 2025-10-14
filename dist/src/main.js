"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const config_1 = require("@nestjs/config");
const class_validator_1 = require("class-validator");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: false });
    (0, class_validator_1.useContainer)(app.select(app_module_1.AppModule), { fallbackOnErrors: true });
    const allowedOrigins = [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
        'https://panel-prestamos.itcooper.mx'
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
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: false,
        forbidNonWhitelisted: false,
        transform: true,
    }));
    app.setGlobalPrefix('api');
    const configService = app.get(config_1.ConfigService);
    const portFromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
    const port = portFromEnv ?? configService.get('PORT') ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map