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

  // Orígenes permitidos (local + Vercel por env)
  const defaultOrigins = ['http://localhost:4200', 'http://127.0.0.1:4200'];
  const frontendOrigin = process.env.FRONTEND_ORIGIN; // p.ej. https://tu-app.vercel.app
  const origins = frontendOrigin ? [...defaultOrigins, frontendOrigin] : defaultOrigins;

  app.enableCors({
    origin: origins,
    credentials: true,
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
