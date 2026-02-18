import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersRepo: Record<string, jest.Mock>;
  let mockJwtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockUsersRepo = { findOne: jest.fn() };
    mockJwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('returns null if user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'pass');

      expect(result).toBeNull();
    });

    it('returns user without password if password matches', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockUsersRepo.findOne.mockResolvedValue({
        id: 1, username: 'admin', password: hash,
        role: UserRole.SUPER_ADMIN, email: 'a@b.com',
      });

      const result = await service.validateUser('admin', 'correct');

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.username).toBe('admin');
      expect(result.password).toBeUndefined();
    });

    it('returns null if password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockUsersRepo.findOne.mockResolvedValue({
        id: 1, username: 'admin', password: hash,
      });

      const result = await service.validateUser('admin', 'wrong');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns access_token and user on valid credentials', async () => {
      const hash = await bcrypt.hash('pass123', 10);
      mockUsersRepo.findOne.mockResolvedValue({
        id: 1, username: 'admin', password: hash,
        email: 'admin@test.com', fullName: 'Admin User',
        role: UserRole.SUPER_ADMIN, isActive: true,
      });

      const result = await service.login('admin', 'pass123');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.username).toBe('admin');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.fullName).toBe('Admin User');
      expect(result.user.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('JWT payload contains username, sub, and role', async () => {
      const hash = await bcrypt.hash('pass123', 10);
      mockUsersRepo.findOne.mockResolvedValue({
        id: 5, username: 'operator', password: hash,
        email: 'op@test.com', fullName: 'Operator',
        role: UserRole.OPERATOR, isActive: true,
      });

      await service.login('operator', 'pass123');

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        username: 'operator',
        sub: 5,
        role: UserRole.OPERATOR,
      });
    });

    it('throws UnauthorizedException on invalid credentials', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(service.login('bad', 'bad')).rejects.toThrow(UnauthorizedException);
    });
  });
});
