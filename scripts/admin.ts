import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    include: {
      accounts: true,
    },
  });
  console.log('\n--- SLIQPAY USER LIST ---');
  console.table(
    users.map((u) => ({
      ID: u.id,
      Email: u.email,
      Phone: u.phone,
      SliqID: u.sliq_id,
      Name: `${u.first_name || ''} ${u.last_name || ''}`,
      Roles: u.roles.join(', '),
      Status: u.is_active ? '✅ Active' : '❌ Deactivated',
      Accounts: u.accounts.length,
    }))
  );
}

async function searchUser(query: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email: { contains: query } }, { phone: { contains: query } }, { sliq_id: { contains: query } }],
    },
    include: { accounts: true },
  });

  if (users.length === 0) {
    console.log(`\n❌ No users found matching "${query}"`);
    return;
  }

  console.log(`\n🔍 Found ${users.length} users matching "${query}":`);
  console.table(
    users.map((u) => ({
      ID: u.id,
      Email: u.email,
      SliqID: u.sliq_id,
      Name: `${u.first_name} ${u.last_name}`,
    }))
  );
}

async function deleteUser(id: string, permanent: boolean = false) {
  try {
    if (permanent) {
      // Permanent delete (Careful!)
      // Note: We might need to delete accounts/transactions first if not set to cascade
      console.log(`\n⚠️ Permanently deleting user ${id}...`);
      await prisma.user.delete({ where: { id } });
      console.log('✅ User permanently deleted from database.');
    } else {
      // Temporary (Soft) delete
      console.log(`\n💤 Deactivating user ${id}...`);
      await prisma.user.update({
        where: { id },
        data: { is_active: false },
      });
      console.log('✅ User marked as inactive.');
    }
  } catch (error: any) {
    console.error('❌ Error deleting user:', error.message);
  }
}

async function listWaitlist() {
  const list = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n--- SLIQPAY WAITLIST ---');
  if (list.length === 0) {
    console.log('Waitlist is currently empty.');
    return;
  }
  console.table(
    list.map((item) => ({
      ID: item.id,
      Email: item.email,
      Name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'N/A',
      Phone: item.phone || 'N/A',
      Joined: item.createdAt,
    }))
  );
  console.log(`Total: ${list.length} entries`);
}

async function promoteUser(id: string, role: string = 'admin') {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return console.log('❌ User not found');
    
    const roles = new Set(user.roles);
    roles.add(role);
    
    await prisma.user.update({
      where: { id },
      data: { roles: Array.from(roles) }
    });
    console.log(`✅ User ${id} promoted to ${role}`);
  } catch (error: any) {
    console.error('❌ Error promoting user:', error.message);
  }
}

async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'list':
      await listUsers();
      break;
    case 'search':
      if (!args[0]) return console.log('Usage: npm run admin search <email/phone/sliqid>');
      await searchUser(args[0]);
      break;
    case 'delete':
      if (!args[0]) return console.log('Usage: npm run admin delete <id> [--perm]');
      const isPerm = args.includes('--perm');
      await deleteUser(args[0], isPerm);
      break;
    case 'waitlist':
      await listWaitlist();
      break;
    case 'promote':
      if (!args[0]) return console.log('Usage: npm run admin promote <id> [role]');
      await promoteUser(args[0], args[1]);
      break;
    default:
      console.log(`
SliqPay Admin CLI
-----------------
Usage:
  tsx scripts/admin.ts list                  - Show all users
  tsx scripts/admin.ts search <query>        - Search by email, phone, or sliq_id
  tsx scripts/admin.ts delete <id>           - Soft delete (deactivate)
  tsx scripts/admin.ts delete <id> --perm    - Permanent delete
  tsx scripts/admin.ts waitlist              - Show waiting list
  tsx scripts/admin.ts promote <id> [role]   - Add role to user (default: admin)
      `);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
