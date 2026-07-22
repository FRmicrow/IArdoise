import { type JWTPayload } from 'jose';
export interface TokenPayload extends JWTPayload {
    role: 'host';
    username: string;
}
export declare function signToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string>;
export declare function verifyToken(token: string): Promise<TokenPayload>;
//# sourceMappingURL=jwt.d.ts.map