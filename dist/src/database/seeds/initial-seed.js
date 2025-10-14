"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const bcrypt = require("bcrypt");
const user_entity_1 = require("../../users/entities/user.entity");
async function seedDatabase(dataSource) {
    const userRepository = dataSource.getRepository(user_entity_1.User);
    const count = await userRepository.count();
    if (count > 0) {
        console.log('Database already seeded');
        return;
    }
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = userRepository.create({
        username: 'admin',
        email: 'admin@sistema.com',
        password: adminPassword,
        fullName: 'Administrador Sistema',
        role: user_entity_1.UserRole.SUPER_ADMIN,
    });
    await userRepository.save(admin);
    const operatorPassword = await bcrypt.hash('operator123', 10);
    const operator = userRepository.create({
        username: 'operador',
        email: 'operador@sistema.com',
        password: operatorPassword,
        fullName: 'Operador Uno',
        role: user_entity_1.UserRole.OPERATOR,
    });
    await userRepository.save(operator);
    console.log('Initial seed completed');
}
//# sourceMappingURL=initial-seed.js.map