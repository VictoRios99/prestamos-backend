import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { useContainer } from 'class-validator';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  // Crear directorio de uploads si no existe
  const uploadsDir = join(process.cwd(), 'uploads', 'profiles');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule, { cors: false });

  // Helmet — headers de seguridad (CSP, X-Frame-Options, etc.)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // class-validator con el contenedor de Nest
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

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
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  // Filtro global de excepciones y logging
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validación global — whitelist filtra campos no declarados en DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global
  app.setGlobalPrefix('api');

  // Puerto
  const configService = app.get(ConfigService);
  const portFromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = portFromEnv ?? configService.get<number>('PORT') ?? 3000;

  await app.listen(port, '127.0.0.1');
  console.log(`Application is running on: http://127.0.0.1:${port}`);
}
bootstrap();
