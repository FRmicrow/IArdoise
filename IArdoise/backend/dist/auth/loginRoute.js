import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { signToken } from './jwt.js';
export async function loginRoute(fastify) {
    fastify.post('/login', async (request, reply) => {
        const { username, password } = request.body ?? {};
        if (typeof username !== 'string' ||
            typeof password !== 'string' ||
            username !== config.username ||
            !(await bcrypt.compare(password, config.passwordHash))) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }
        const token = await signToken({ role: 'host', username });
        return reply.code(200).send({ token });
    });
}
//# sourceMappingURL=loginRoute.js.map