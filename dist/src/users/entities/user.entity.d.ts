export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    OPERATOR = "OPERATOR"
}
export declare class User {
    id: number;
    username: string;
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
