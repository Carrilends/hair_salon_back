import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { jwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
// import { UpdateAuthDto } from './dto/update-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = this.userRepository.create({
        ...createUserDto,
        password: bcrypt.hashSync(createUserDto.password, 10),
      });
      await this.userRepository.save(user);
      return {
        ...user,
        token: this.getJwtToken({ id: user.id }),
      };
      // TODO: Retornar el JWT
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      const { email, password } = loginUserDto;
      const user = await this.userRepository.findOne({
        where: { email },
        select: ['email', 'password', 'id'],
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
        token: this.getJwtToken({ id: user.id }),
      };
    } catch (error) {
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
    return {
      ...user,
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
    console.log(error);
    throw new InternalServerErrorException('Please check the logs');
  }
}
