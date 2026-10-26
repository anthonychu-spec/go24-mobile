import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionValidator } from './session-validator';

export interface JwtPayload {
  sub: string;       // user.id (UUID)
  sid: string;       // session id — revoking the session revokes the access token
  pgmId: number;
  role: 'member' | 'trainer' | 'admin';
  jti: string;
}

export interface AuthedUser {
  id: string;
  sessionId: string;
  pgmId: number;
  role: 'member' | 'trainer' | 'admin';
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, private readonly sessions: SessionValidator) {
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

  async validate(payload: JwtPayload): Promise<AuthedUser> {
    if (!payload.sub || !payload.sid) throw new UnauthorizedException('invalid token');
    if (!(await this.sessions.isValid(payload.sid, payload.sub))) {
      throw new UnauthorizedException('session ended');
    }
    return { id: payload.sub, sessionId: payload.sid, pgmId: payload.pgmId, role: payload.role, jti: payload.jti };
  }
}
