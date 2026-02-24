export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    ADMIN = "ADMIN",
    OPERATOR = "OPERATOR",
    AUDITOR = "AUDITOR"
}
export declare class User {
    id: number;
    username: string;
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    profilePhoto: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
