import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address. Example: npm run make-admin admin@example.com');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log(`Looking for user: ${normalizedEmail}...`);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  
  if (!user) {
    console.error(`Error: User with email ${normalizedEmail} not found in the database.`);
    console.error('Make sure you have registered this account in the app first!');
    process.exit(1);
  }

  // Get or create admin role
  let adminRole = await prisma.systemRole.findUnique({ where: { name: 'admin' } });
  if (!adminRole) {
    console.log('Admin role not found, creating it...');
    adminRole = await prisma.systemRole.create({
      data: { name: 'admin', permissions: ['*'] }
    });
  }

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: { systemRoleId: adminRole.id }
  });

  console.log(`\n✅ SUCCESS!`);
  console.log(`User ${normalizedEmail} has been promoted to Admin.`);
  console.log(`They can now access all admin features upon next login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
