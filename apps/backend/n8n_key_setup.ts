import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
async function main() {
  const userId = '204e0adf-38a4-43d1-bb44-a948c2552128';
  const keyId = crypto.randomUUID();
  const apiKey = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  // Delete old if exists
  await prisma.$executeRaw`DELETE FROM user_api_keys WHERE label='AI Platform'`;

  // Insert new
  await prisma.$executeRaw`
    INSERT INTO user_api_keys (id, "userId", label, "apiKey", "createdAt", "updatedAt")
    VALUES (${keyId}, ${userId}, 'AI Platform', ${apiKey}, ${now}, ${now})
  `;
  console.log('SUCCESS: n8n API Key =>', apiKey);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
