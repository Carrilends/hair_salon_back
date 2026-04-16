import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  const strongPassword = 'Str0ngP@ssw0rd!';

  let service: AuthService;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(() => {
    userRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };

    service = new AuthService(userRepository as any, jwtService as any);
  });

  describe('create', () => {
    it('creates user, hashes password, returns token', async () => {
      const dto = {
        email: 'USER@EXAMPLE.COM',
        fullName: 'Test User',
        password: strongPassword,
      };

      (userRepository.create as jest.Mock).mockImplementation((u) => u);
      (userRepository.save as jest.Mock).mockResolvedValue(undefined);

      const result = await service.create(dto as any);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          fullName: dto.fullName,
          password: expect.any(String),
        }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ id: undefined }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          email: dto.email,
          fullName: dto.fullName,
          token: 'jwt-token',
        }),
      );
      expect(result.password).toBeDefined();
      expect(result.password).not.toBe(dto.password);
    });

    it('throws BadRequest on duplicate email', async () => {
      const dto = {
        email: 'user@example.com',
        fullName: 'Test User',
        password: strongPassword,
      };

      (userRepository.create as jest.Mock).mockImplementation((u) => u);
      (userRepository.save as jest.Mock).mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(user@example.com) already exists.',
      });

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    it('returns token when credentials are valid', async () => {
      const dto = { email: 'user@example.com', password: strongPassword };

      (userRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: dto.email,
        password: '$2b$10$hash',
        fullName: 'Test User',
        roles: ['admin'],
      });

      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(true);

      const result = await service.login(dto as any);

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: dto.email },
          select: expect.any(Array),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-id',
          email: dto.email,
          fullName: 'Test User',
          roles: ['admin'],
          token: 'jwt-token',
        }),
      );
    });

    it('throws Unauthorized when user not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: strongPassword } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when password mismatch', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        password: '$2b$10$hash',
        fullName: 'Test User',
        roles: ['user'],
      });

      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false);

      await expect(
        service.login({
          email: 'user@example.com',
          password: strongPassword,
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('checkAuthStatus', () => {
    it('returns user with token', () => {
      const user = { id: 'id-1', email: 'a@b.com' } as any;
      const result = service.checkAuthStatus(user);

      expect(result).toEqual(expect.objectContaining({ token: 'jwt-token' }));
      expect(jwtService.sign).toHaveBeenCalledWith({ id: 'id-1' });
    });
  });
});
