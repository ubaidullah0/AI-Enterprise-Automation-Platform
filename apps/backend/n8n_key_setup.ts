import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const userId = '204e0adf-38a4-43d1-bb44-a948c2552128';
  const keyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const apiKey = 'n8n_api_aiplatform2026securekey';
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
