// typeorm.config.ts
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

// Koyeb inyecta las vars en process.env.
// Activamos SSL si DB_SSL=true
const sslEnabled = (process.env.DB_SSL ?? '').toLowerCase() === 'true';

const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  // Requerido por Postgres administrado (Koyeb)
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  extra: sslEnabled ? { sslmode: 'require' } : {},

  // Rutas para ts-node (CLI) y JS compilado
  entities: [join(__dirname, 'src', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'src', 'database', 'migrations', '*.{ts,js}')],

  synchronize: false,
  logging: false,
};

export default new DataSource(options);
