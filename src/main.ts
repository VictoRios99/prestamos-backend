import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { useContainer } from 'class-validator';

async function bootstrap() {
  // Desactiva CORS aquí y lo habilitamos explícitamente abajo
  const app = await NestFactory.create(AppModule, { cors: false });

  // class-validator con el contenedor de Nest
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const allowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://prestamos-frontend-static.vercel.app/', // <— TU dominio real en Vercel
    // 'https://prestamos-frontend.vercel.app',      // (opcional) si tienes otro proyecto/alias
  ];

  const frontendOriginsFromEnv = process.env.FRONTEND_ORIGIN;
  if (frontendOriginsFromEnv) {
    const additionalOrigins = frontendOriginsFromEnv.split(',').map(origin => origin.trim());
    allowedOrigins.push(...additionalOrigins);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // permitir llamadas sin origin (p.ej. curl/health) y orígenes listados
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  // Validación global (tal como la tienes)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Prefijo global
  app.setGlobalPrefix('api');

  // Puerto: Render inyecta process.env.PORT
  const configService = app.get(ConfigService);
  const portFromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = portFromEnv ?? configService.get<number>('PORT') ?? 3000;

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
