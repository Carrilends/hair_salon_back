import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { jwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
// import { UpdateAuthDto } from './dto/update-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(ReviewByUser)
    private reviewByUserRepository: Repository<ReviewByUser>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = this.userRepository.create({
        ...createUserDto,
        password: bcrypt.hashSync(createUserDto.password, 10),
        roles: ['user'],
      });
      await this.userRepository.save(user);
      return {
        ...user,
        token: this.getJwtToken({ id: user.id }),
      };
      // TODO: Retornar el JWT
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      const { email, password } = loginUserDto;
      const user = await this.userRepository.findOne({
        where: { email },
        select: ['email', 'password', 'id', 'fullName', 'roles'],
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!bcrypt.compareSync(password, user.password)) {
        throw new UnauthorizedException('Invalid credentials');
      }
      // TODO: Retornar el JWT
      return {
        ...user,
        token: this.getJwtToken({ id: user.id }), // puede que aqui este el error porque el token no firma los roles
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleDBErrors(error);
    }
  }

  /* findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  } */

  checkAuthStatus(user: User) {
    return this.buildAuthResponse(user);
  }

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    const dbUser = await this.userRepository.findOneBy({ id: user.id });
    if (!dbUser) {
      throw new UnauthorizedException('Invalid token');
    }

    const nextFullName = updateProfileDto.fullName.trim();
    dbUser.fullName = nextFullName;
    const updatedUser = await this.userRepository.save(dbUser);

    const reviewsByUser = await this.reviewByUserRepository.find({
      where: { user: { id: user.id } },
      relations: ['review'],
    });
    if (reviewsByUser.length > 0) {
      const reviewsToUpdate = reviewsByUser
        .map((relation) => relation.review)
        .filter((review): review is Review => Boolean(review))
        .map((review) => {
          review.name = nextFullName;
          return review;
        });

      if (reviewsToUpdate.length > 0) {
        await this.reviewRepository.save(reviewsToUpdate);
      }
    }

    return this.buildAuthResponse(updatedUser);
  }

  async updateEmail(user: User, updateEmailDto: UpdateEmailDto) {
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
      select: ['id', 'email', 'password', 'fullName', 'roles', 'isActive'],
    });

    if (!dbUser) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!bcrypt.compareSync(updateEmailDto.currentPassword, dbUser.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedEmail = updateEmailDto.newEmail.toLowerCase().trim();
    if (normalizedEmail === dbUser.email) {
      throw new BadRequestException('New email must be different');
    }

    dbUser.email = normalizedEmail;
    const updatedUser = await this.userRepository.save(dbUser);
    return this.buildAuthResponse(updatedUser);
  }

  async updatePassword(user: User, updatePasswordDto: UpdatePasswordDto) {
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
      select: ['id', 'email', 'password', 'fullName', 'roles', 'isActive'],
    });

    if (!dbUser) {
      throw new UnauthorizedException('Invalid token');
    }

    if (
      !bcrypt.compareSync(updatePasswordDto.currentPassword, dbUser.password)
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (updatePasswordDto.currentPassword === updatePasswordDto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    dbUser.password = bcrypt.hashSync(updatePasswordDto.newPassword, 10);
    const updatedUser = await this.userRepository.save(dbUser);
    return this.buildAuthResponse(updatedUser);
  }

  private buildAuthResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      isActive: user.isActive,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: jwtPayload) {
    return this.jwtService.sign(payload);
  }

  private handleDBErrors(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    throw new InternalServerErrorException('Please check the logs');
  }
}
