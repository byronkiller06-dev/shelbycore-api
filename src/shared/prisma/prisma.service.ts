import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Base de datos conectada.');
    } catch (e) {
      // No tumbamos la app: buscar/calificar con Gemini funciona sin DB.
      // Solo "Guardar en CRM" necesita la base de datos.
      this.logger.warn('No se pudo conectar a la base de datos. La búsqueda funciona; "Guardar en CRM" necesitará la DB.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.$disconnect(); } catch { /* noop */ }
  }
}
