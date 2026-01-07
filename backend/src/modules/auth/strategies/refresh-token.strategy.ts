import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwt.refreshSecret') as string,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();
    
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        token: refreshToken,
        userId: payload.sub,
        type: 'REFRESH_TOKEN',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      throw new Error('Invalid or expired refresh token');
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}