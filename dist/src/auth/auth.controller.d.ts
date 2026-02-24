import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivityService } from '../activity/activity.service';
import { Request } from 'express';
export declare class AuthController {
    private authService;
    private activityService;
    constructor(authService: AuthService, activityService: ActivityService);
    login(loginDto: LoginDto, req: Request): Promise<{
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
    logout(req: Request): Promise<{
        message: string;
    }>;
}
