import { config as dotenvConfig } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
dotenvConfig({ path: join(rootDir, '.env') });
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