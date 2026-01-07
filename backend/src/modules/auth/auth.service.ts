import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  UserRole,
  TokenType,
  JwtPayload,
  AuthTokens,
} from '../../shared/types/user.types';
import { EmailService } from '../../shared/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      this.configService.get('bcrypt.saltRounds', 10),
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: role || UserRole.CUSTOMER,
      },
    });

    // Generate email verification token
    const verificationToken = await this.generateToken(
      user.id,
      TokenType.EMAIL_VERIFICATION,
    );

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken);

    // Generate tokens
    const tokens = await this.generateAuthTokens(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateAuthTokens(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      // Find token in database
      const tokenRecord = await this.prisma.token.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          type: TokenType.REFRESH_TOKEN,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Mark token as used
      await this.prisma.token.update({
        where: { id: tokenRecord.id },
        data: { isUsed: true },
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      return this.generateAuthTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    // Find token
    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        token,
        type: TokenType.EMAIL_VERIFICATION,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user
    await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { isEmailVerified: true },
    });

    // Mark token as used
    await this.prisma.token.update({
      where: { id: tokenRecord.id },
      data: { isUsed: true },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // Generate password reset token
    const resetToken = await this.generateToken(
      user.id,
      TokenType.PASSWORD_RESET,
    );

    // Send reset email
    await this.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link will be sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Find token
    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        token,
        type: TokenType.PASSWORD_RESET,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      this.configService.get('bcrypt.saltRounds', 10),
    );

    // Update user password
    await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await this.prisma.token.update({
      where: { id: tokenRecord.id },
      data: { isUsed: true },
    });

    // Invalidate all refresh tokens
    await this.prisma.token.updateMany({
      where: {
        userId: tokenRecord.userId,
        type: TokenType.REFRESH_TOKEN,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    return { message: 'Password reset successfully' };
  }

  async logout(userId: string) {
    // Invalidate all refresh tokens for the user
    await this.prisma.token.updateMany({
      where: {
        userId,
        type: TokenType.REFRESH_TOKEN,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isEmailVerified: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Helper Methods
  private async generateAuthTokens(user: any): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    // Store refresh token in database
    await this.generateToken(user.id, TokenType.REFRESH_TOKEN, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateToken(
    userId: string,
    type: TokenType,
    customToken?: string,
  ): Promise<string> {
    const token = customToken || this.generateRandomToken();
    const expiresAt = this.getTokenExpiry(type);

    await this.prisma.token.create({
      data: {
        userId,
        token,
        type,
        expiresAt,
      },
    });

    return token;
  }

  private generateRandomToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

private getTokenExpiry(type: string): Date {
  const now = new Date();
  
  switch (type) {
    case 'EMAIL_VERIFICATION':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    case 'PASSWORD_RESET':
      return new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
    case 'REFRESH_TOKEN':
      const expiry = this.configService.get('jwt.refreshExpiresIn', '7d');
      return new Date(now.getTime() + this.parseJwtExpiry(expiry));
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

private parseJwtExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

  private parseJwtExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${this.configService.get('frontendUrl')}/verify-email?token=${token}`;

    try {
      await this.emailService.sendEmail({
        to: email,
        subject: 'Verify Your Email - Ecommerce Platform',
        html: `
          <h1>Welcome to Ecommerce Platform!</h1>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        `,
      });
    } catch (error) {
      // Log error but don't fail the registration
      console.error('Failed to send verification email:', error);
    }
  }

  private async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${this.configService.get('frontendUrl')}/reset-password?token=${token}`;

    try {
      await this.emailService.sendEmail({
        to: email,
        subject: 'Reset Your Password - Ecommerce Platform',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested to reset your password. Click the link below:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }
  }
}
