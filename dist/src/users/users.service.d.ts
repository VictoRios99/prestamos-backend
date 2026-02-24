import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    findByUsername(username: string): Promise<User | null>;
    findById(id: number): Promise<User | null>;
    findAll(): Promise<User[]>;
    create(dto: CreateUserDto): Promise<User>;
    update(id: number, dto: UpdateUserDto): Promise<User>;
    updateProfilePhoto(id: number, photoPath: string): Promise<User>;
}
