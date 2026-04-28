import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;       // user.id (UUID)
  pgmId: number;
  role: 'member' | 'trainer' | 'admin';
  jti: string;
}

export interface AuthedUser {
  id: string;
  pgmId: number;
  role: 'member' | 'trainer' | 'admin';
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    const secret = cfg.get<string>('JWT_SECRET');
    if (!secret || secret === 'change-me-to-a-long-random-string') {
      throw new Error('JWT_SECRET not configured (set strong value in .env.local)');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthedUser {
    if (!payload.sub) throw new UnauthorizedException('invalid token');
    return { id: payload.sub, pgmId: payload.pgmId, role: payload.role, jti: payload.jti };
  }
}
