import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

export interface TokenPayload extends JWTPayload {
  role: 'host';
  username: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export async function signToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as TokenPayload;
}
