import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User, UserRole } from './users/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);
    const userRepository = dataSource.getRepository(User);

    console.log('🚀 Iniciando seed de datos...');
    console.log('➕ Creando o verificando usuarios...');

    // Admin
    let adminUser = await userRepository.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      adminUser = userRepository.create({
        username: 'admin',
        email: 'admin@sistema.com',
        password: adminPassword,
        fullName: 'Administrador Sistema',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      } as Partial<User>);
      await userRepository.save(adminUser);
      console.log('✅ Usuario admin creado');
    } else {
      console.log('✅ Usuario admin ya existe');
    }

    // Operador
    let operatorUser = await userRepository.findOne({ where: { username: 'operador' } });
    if (!operatorUser) {
      const operatorPassword = await bcrypt.hash('operator123', 10);
      operatorUser = userRepository.create({
        username: 'operador',
        email: 'operador@sistema.com',
        password: operatorPassword,
        fullName: 'Operador Uno',
        role: UserRole.OPERATOR,
        isActive: true,
      } as Partial<User>);
      await userRepository.save(operatorUser);
      console.log('✅ Usuario operador creado');
    } else {
      console.log('✅ Usuario operador ya existe');
    }

    console.log('🎉 Seed (usuarios) completado exitosamente');
    console.log('👤 Admin - username: admin, password: admin123');
    console.log('👤 Operador - username: operador, password: operator123');
  } catch (error: any) {
    console.error('❌ Error en el seed:', error.message || error);
  } finally {
    await app.close();
  }
}

bootstrap().catch(error => {
  console.error('❌ Error crítico en el seed:', error);
  process.exit(1);
});
