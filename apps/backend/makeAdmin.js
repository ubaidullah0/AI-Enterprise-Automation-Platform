const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgres://postgres:5YdRsBCZ5VQPGPj8@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function main() {
  const email = 'obaidkhan224433@gmail.com';
  
  // Find the user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found!');
    return;
  }

  // Get or create the admin role
  let adminRole = await prisma.systemRole.findUnique({ where: { name: 'admin' } });
  if (!adminRole) {
    adminRole = await prisma.systemRole.create({
      data: { name: 'admin', permissions: ['*'] }
    });
  }

  // Update the user
  const updated = await prisma.user.update({
    where: { email },
    data: { systemRoleId: adminRole.id }
  });

  console.log('Success! User is now admin:', updated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
