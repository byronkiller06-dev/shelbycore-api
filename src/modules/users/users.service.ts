import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, createdAt: true, roles: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  roles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId } });
  }
}
