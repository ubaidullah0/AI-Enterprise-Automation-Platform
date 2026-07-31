import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create Default System Roles
  const sysAdminRole = await prisma.systemRole.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: {
      name: 'superadmin',
      description: 'System Administrator with full access to everything',
      permissions: ['*'],
    },
  });

  const sysUserRole = await prisma.systemRole.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Standard System User',
      permissions: ['read:own_data', 'write:own_data'],
    },
  });

  // 2. Create Default Organization Roles
  const orgOwnerRole = await prisma.organizationRole.upsert({
    where: { name: 'OWNER' },
    update: {},
    create: {
      name: 'OWNER',
      description: 'Owner of the organization',
      permissions: ['*'],
    },
  });

  const orgAdminRole = await prisma.organizationRole.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Admin of the organization',
      permissions: ['org:read', 'org:write', 'members:read', 'members:write', 'workflows:read', 'workflows:write'],
    },
  });

  const orgMemberRole = await prisma.organizationRole.upsert({
    where: { name: 'MEMBER' },
    update: {},
    create: {
      name: 'MEMBER',
      description: 'Standard member',
      permissions: ['org:read', 'members:read', 'workflows:read'],
    },
  });

  console.log('Roles created.');

  // 3. Create Default Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
    },
  });

  console.log('Organization created.');

  // 4. Create Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      email: 'admin@admin.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      systemRoleId: sysAdminRole.id,
      activeOrganizationId: org.id,
      isEmailVerified: true,
    },
  });

  // 5. Add Admin User as Owner of Acme Corp
  await prisma.organizationMember.create({
    data: {
      userId: admin.id,
      organizationId: org.id,
      roleId: orgOwnerRole.id,
    }
  });

  console.log('Admin user and membership created:', admin.email);

  // 6. Initial Settings (Global settings can just be placed on a default org or a system setting table. Since we removed Setting, we'll put it on the Organization)
  await prisma.organizationSetting.create({
    data: {
      organizationId: org.id,
      key: 'default_ai_provider',
      value: 'openai',
    }
  });

  console.log('Settings created.');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
