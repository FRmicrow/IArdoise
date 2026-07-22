import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
function getSecret() {
    return new TextEncoder().encode(config.jwtSecret);
}
export async function signToken(payload) {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(getSecret());
}
export async function verifyToken(token) {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
}
//# sourceMappingURL=jwt.js.map