import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from './decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  tid: string;
  email: string;
  roles: string[];
  scopes: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    return {
      userId: payload.sub,
      tenantId: payload.tid,
      email: payload.email,
      roles: payload.roles ?? [],
      scopes: payload.scopes ?? [],
    };
  }
}
