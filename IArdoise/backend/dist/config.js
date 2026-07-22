import 'dotenv/config';
function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
export const config = {
    username: requireEnv('HOST_USERNAME'),
    passwordHash: requireEnv('HOST_PASSWORD_HASH'),
    jwtSecret: requireEnv('JWT_SECRET'),
    port: parseInt(process.env['PORT'] ?? '3000', 10),
};
//# sourceMappingURL=config.js.map