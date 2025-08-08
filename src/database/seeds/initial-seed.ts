import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';

export async function seedDatabase(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);

  // Verificar si ya existen usuarios
  const count = await userRepository.count();
  if (count > 0) {
    console.log('Database already seeded');
    return;
  }

  // Crear usuario administrador
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = userRepository.create({
    username: 'admin',
    email: 'admin@sistema.com',
    password: adminPassword,
    fullName: 'Administrador Sistema',
    role: UserRole.SUPER_ADMIN,
  });
  await userRepository.save(admin);

  // Crear usuario operador
  const operatorPassword = await bcrypt.hash('operator123', 10);
  const operator = userRepository.create({
    username: 'operador',
    email: 'operador@sistema.com',
    password: operatorPassword,
    fullName: 'Operador Uno',
    role: UserRole.OPERATOR,
  });
  await userRepository.save(operator);

  console.log('Initial seed completed');
}