import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Base de datos conectada.');
      await this.runSchemaMigrations();
    } catch (e) {
      this.logger.warn('No se pudo conectar a la base de datos. La búsqueda funciona; "Guardar en CRM" necesitará la DB.');
    }
  }

  private async runSchemaMigrations(): Promise<void> {
    // Idempotent: adds new columns without touching existing data
    const migrations = [
      `ALTER TABLE "ShelbyProduct" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE "ShelbyProduct" ADD COLUMN IF NOT EXISTS "salesPriority" TEXT NOT NULL DEFAULT 'media'`,
      `ALTER TABLE "ShelbyProduct" ADD COLUMN IF NOT EXISTS "commercialMargin" TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE "ProspectPackage" ADD COLUMN IF NOT EXISTS "selectedProductIds" TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE "ProspectPackage" ADD COLUMN IF NOT EXISTS "salesPriority" TEXT NOT NULL DEFAULT 'media'`,
      `ALTER TABLE "ProspectPackage" ADD COLUMN IF NOT EXISTS "commercialMargin" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      // Phase 4 — Respuesta del cliente + Hotspots
      `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "hotspotAt" TIMESTAMP(3)`,
      `CREATE INDEX IF NOT EXISTS "Customer_tenantId_hotspotAt_idx" ON "Customer"("tenantId", "hotspotAt")`,
      `CREATE TABLE IF NOT EXISTS "ClientResponse" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "responseText" TEXT NOT NULL DEFAULT '',
        "channel" TEXT NOT NULL DEFAULT 'whatsapp',
        "intent" TEXT NOT NULL DEFAULT 'neutral',
        "urgency" TEXT NOT NULL DEFAULT 'media',
        "hotspot" BOOLEAN NOT NULL DEFAULT false,
        "recommendation" TEXT NOT NULL DEFAULT 'schedule_followup',
        "replyMessage" TEXT NOT NULL DEFAULT '',
        "whatsappText" TEXT NOT NULL DEFAULT '',
        "emailSubject" TEXT NOT NULL DEFAULT '',
        "emailBody" TEXT NOT NULL DEFAULT '',
        "reasoning" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClientResponse_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ClientResponse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS "ClientResponse_tenantId_customerId_idx" ON "ClientResponse"("tenantId", "customerId")`,
      `CREATE INDEX IF NOT EXISTS "ClientResponse_tenantId_hotspot_idx" ON "ClientResponse"("tenantId", "hotspot")`,
    ];
    for (const sql of migrations) {
      try { await this.$executeRawUnsafe(sql); } catch { /* column already exists */ }
    }
    this.logger.log('Schema migrations OK.');
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.$disconnect(); } catch { /* noop */ }
  }
}
