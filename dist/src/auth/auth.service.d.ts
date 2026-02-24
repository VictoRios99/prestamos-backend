import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private usersRepository;
    private jwtService;
    constructor(usersRepository: Repository<User>, jwtService: JwtService);
    validateUser(username: string, password: string): Promise<any>;
    login(username: string, password: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            fullName: any;
            role: any;
            isActive: any;
            profilePhoto: any;
        };
    }>;
}
