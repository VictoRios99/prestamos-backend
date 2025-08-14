import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar class-validator para usar el contenedor de NestJS
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Configurar CORS
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    credentials: true,
  });

  // Configurar validación global pero más permisiva
  app.useGlobalPipes(new ValidationPipe({
    whitelist: false, // Permitir propiedades adicionales
    forbidNonWhitelisted: false, // No rechazar propiedades no listadas
    transform: true,
  }));

  // Configurar prefix global para API
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
