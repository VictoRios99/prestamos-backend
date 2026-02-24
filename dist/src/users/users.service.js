"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const bcrypt = require("bcrypt");
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async findByUsername(username) {
        return this.usersRepository.findOne({ where: { username } });
    }
    async findById(id) {
        return this.usersRepository.findOne({ where: { id } });
    }
    async findAll() {
        return this.usersRepository.find({ order: { createdAt: 'DESC' } });
    }
    async create(dto) {
        const existingUsername = await this.usersRepository.findOne({ where: { username: dto.username } });
        if (existingUsername) {
            throw new common_1.ConflictException('El nombre de usuario ya existe');
        }
        const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
        if (existingEmail) {
            throw new common_1.ConflictException('El email ya está registrado');
        }
        if (dto.role === user_entity_1.UserRole.SUPER_ADMIN) {
            throw new common_1.ForbiddenException('No se puede crear un usuario SUPER_ADMIN');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = this.usersRepository.create({
            ...dto,
            password: hashedPassword,
            role: dto.role || user_entity_1.UserRole.OPERATOR,
        });
        return this.usersRepository.save(user);
    }
    async update(id, dto) {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        if (dto.email && dto.email !== user.email) {
            const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
            if (existingEmail) {
                throw new common_1.ConflictException('El email ya está registrado');
            }
        }
        if (dto.role === user_entity_1.UserRole.SUPER_ADMIN) {
            throw new common_1.ForbiddenException('No se puede asignar el rol SUPER_ADMIN');
        }
        if (dto.password) {
            dto.password = await bcrypt.hash(dto.password, 10);
        }
        Object.assign(user, dto);
        return this.usersRepository.save(user);
    }
    async updateProfilePhoto(id, photoPath) {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        user.profilePhoto = photoPath;
        return this.usersRepository.save(user);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map