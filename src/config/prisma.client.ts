import { PrismaClient } from '@prisma/client';

const logOptions: any = [
    { level: 'query', emit: 'event' as const },
    'info' as const,
    'warn' as const,
    'error' as const
];

const prisma = new PrismaClient({
    log: logOptions
});

export default prisma;