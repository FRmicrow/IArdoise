import 'dotenv/config';

export interface Config {
  username: string;
  passwordHash: string;
  jwtSecret: string;
  port: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  username: requireEnv('HOST_USERNAME'),
  passwordHash: requireEnv('HOST_PASSWORD_HASH'),
  jwtSecret: requireEnv('JWT_SECRET'),
  port: parseInt(process.env['PORT'] ?? '3000', 10),
};
