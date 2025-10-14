"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const path_1 = require("path");
const sslEnabled = (process.env.DB_SSL ?? '').toLowerCase() === 'true';
const options = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    extra: sslEnabled ? { sslmode: 'require' } : {},
    entities: [(0, path_1.join)(__dirname, 'src', '**', '*.entity.{ts,js}')],
    migrations: [(0, path_1.join)(__dirname, 'src', 'database', 'migrations', '*.{ts,js}')],
    synchronize: false,
    logging: false,
};
exports.default = new typeorm_1.DataSource(options);
//# sourceMappingURL=typeorm.config.js.map