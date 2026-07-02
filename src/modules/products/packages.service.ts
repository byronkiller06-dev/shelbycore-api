import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface PackageInput {
  tenantId: string;
  customerId: string;
  mainProduct: string;
  complementary: string[];
  packageName: string;
  explanation: string;
  estimatedValue: number;
  suggestedStrategy: string;
  whatsappMessage?: string;
  emailSubject?: string;
  emailBody?: string;
  followUpDate?: number;
  selectedProductIds?: string[];
  salesPriority?: string;
  commercialMargin?: number;
}

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: PackageInput) {
    const base = {
      tenantId:           input.tenantId,
      customerId:         input.customerId,
      mainProduct:        input.mainProduct,
      complementary:      JSON.stringify(input.complementary ?? []),
      packageName:        input.packageName,
      explanation:        input.explanation,
      estimatedValue:     input.estimatedValue ?? 0,
      suggestedStrategy:  input.suggestedStrategy,
      selectedProductIds: JSON.stringify(input.selectedProductIds ?? []),
      salesPriority:      input.salesPriority ?? 'media',
      commercialMargin:   input.commercialMargin ?? 0,
    };
    return this.prisma.prospectPackage.upsert({
      where: { customerId: input.customerId },
      create: {
        ...base,
        whatsappMessage: input.whatsappMessage ?? '',
        emailSubject:    input.emailSubject ?? '',
        emailBody:       input.emailBody ?? '',
        followUpDate:    input.followUpDate ?? 3,
      },
      update: {
        ...base,
        ...(input.whatsappMessage !== undefined && { whatsappMessage: input.whatsappMessage }),
        ...(input.emailSubject    !== undefined && { emailSubject:    input.emailSubject }),
        ...(input.emailBody       !== undefined && { emailBody:       input.emailBody }),
        ...(input.followUpDate    !== undefined && { followUpDate:    input.followUpDate }),
      },
    });
  }

  getForCustomer(tenantId: string, customerId: string) {
    return this.prisma.prospectPackage.findFirst({ where: { customerId, tenantId } });
  }
}
