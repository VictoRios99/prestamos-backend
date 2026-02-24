"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const bcrypt = require("bcrypt");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./users/entities/user.entity");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const dataSource = app.get(typeorm_1.DataSource);
        const userRepository = dataSource.getRepository(user_entity_1.User);
        console.log('🚀 Iniciando seed de datos...');
        console.log('➕ Creando o verificando usuarios...');
        let adminUser = await userRepository.findOne({
            where: { username: 'admin' },
        });
        if (!adminUser) {
            const adminPassword = await bcrypt.hash('admin123', 10);
            adminUser = userRepository.create({
                username: 'admin',
                email: 'admin@sistema.com',
                password: adminPassword,
                fullName: 'Administrador Sistema',
                role: user_entity_1.UserRole.SUPER_ADMIN,
                isActive: true,
            });
            await userRepository.save(adminUser);
            console.log('✅ Usuario admin creado');
        }
        else {
            console.log('✅ Usuario admin ya existe');
        }
        let operatorUser = await userRepository.findOne({
            where: { username: 'operador' },
        });
        if (!operatorUser) {
            const operatorPassword = await bcrypt.hash('operator123', 10);
            operatorUser = userRepository.create({
                username: 'operador',
                email: 'operador@sistema.com',
                password: operatorPassword,
                fullName: 'Operador Uno',
                role: user_entity_1.UserRole.OPERATOR,
                isActive: true,
            });
            await userRepository.save(operatorUser);
            console.log('✅ Usuario operador creado');
        }
        else {
            console.log('✅ Usuario operador ya existe');
        }
        let auditorUser = await userRepository.findOne({
            where: { username: 'auditor' },
        });
        if (!auditorUser) {
            const auditorPassword = await bcrypt.hash('auditor123', 10);
            auditorUser = userRepository.create({
                username: 'auditor',
                email: 'auditor@sistema.com',
                password: auditorPassword,
                fullName: 'Auditor Sistema',
                role: user_entity_1.UserRole.AUDITOR,
                isActive: true,
            });
            await userRepository.save(auditorUser);
            console.log('✅ Usuario auditor creado');
        }
        else {
            console.log('✅ Usuario auditor ya existe');
        }
        console.log('🎉 Seed (usuarios) completado exitosamente');
        console.log('👤 Admin - username: admin, password: admin123');
        console.log('👤 Operador - username: operador, password: operator123');
        console.log('👤 Auditor - username: auditor, password: auditor123');
    }
    catch (error) {
        console.error('❌ Error en el seed:', error.message || error);
    }
    finally {
        await app.close();
    }
}
bootstrap().catch((error) => {
    console.error('❌ Error crítico en el seed:', error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map