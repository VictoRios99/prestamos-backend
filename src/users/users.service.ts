import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existingUsername = await this.usersRepository.findOne({ where: { username: dto.username } });
    if (existingUsername) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('No se puede crear un usuario SUPER_ADMIN');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      ...dto,
      password: hashedPassword,
      role: dto.role || UserRole.OPERATOR,
    });

    return this.usersRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existingEmail) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('No se puede asignar el rol SUPER_ADMIN');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async updateProfilePhoto(id: number, photoPath: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.profilePhoto = photoPath;
    return this.usersRepository.save(user);
  }
}
