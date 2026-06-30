import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_AGENTS } from '../src/modules/agents/agents.seed';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@shelbycore.ai';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'shelbycore123';

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log(`Seed: el usuario ${email} ya existe. Nada que hacer.`);
    return;
  }

  const org = await prisma.organization.create({ data: { name: 'ShelbyCore' } });
  const tenant = await prisma.tenant.create({
    data: { orgId: org.id, name: 'ShelbyCore', slug: 'shelbycore', status: 'ACTIVE', plan: 'ENTERPRISE' },
  });

  const adminRole = await prisma.role.create({ data: { tenantId: tenant.id, name: 'admin', scopes: JSON.stringify(['*']) } });
  await prisma.role.create({ data: { tenantId: tenant.id, name: 'operator', scopes: JSON.stringify(['crm:read', 'crm:write', 'tasks:read', 'tasks:write', 'docs:read', 'docs:write', 'agents:read']) } });
  await prisma.role.create({ data: { tenantId: tenant.id, name: 'viewer', scopes: JSON.stringify(['crm:read', 'tasks:read', 'agents:read', 'docs:read']) } });

  await prisma.user.create({
    data: {
      tenantId: tenant.id, email, name: 'Admin', passwordHash: await bcrypt.hash(password, 10),
      roles: { connect: { id: adminRole.id } },
    },
  });

  await prisma.agent.createMany({
    data: DEFAULT_AGENTS.map((a) => ({ tenantId: tenant.id, code: a.code, name: a.name, domain: a.domain, manifest: JSON.stringify(a.manifest) })),
  });

  console.log('───────────────────────────────────────────────');
  console.log(' Seed completado (solo configuración, sin datos ficticios)');
  console.log(`  Tenant : ${tenant.slug}`);
  console.log(`  Login  : ${email}`);
  console.log(`  Pass   : ${password}`);
  console.log(`  Agentes: ${DEFAULT_AGENTS.length} provisionados`);
  console.log('───────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
