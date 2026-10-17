import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { partnerCityLabel } from './partner-city-label';

/** Hard cap so the landing strip cannot grow unbounded. */
export const PARTNER_CENTERS_LIMIT = 50;

export interface PartnerCenterDto {
  id: string;
  name: string;
  logoUrl: string;
  city: string | null;
}

@Injectable()
export class PartnerCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPartners(): Promise<{ centers: PartnerCenterDto[] }> {
    const rows = await this.prisma.center.findMany({
      where: {
        logo_url: { not: null },
        NOT: { logo_url: '' },
      },
      select: {
        id: true,
        name: true,
        logo_url: true,
        city_id: true,
        city_other: true,
      },
      orderBy: { name: 'asc' },
      take: PARTNER_CENTERS_LIMIT,
    });

    return {
      centers: rows.map((row) => ({
        id: row.id,
        name: row.name,
        logoUrl: row.logo_url as string,
        city: partnerCityLabel(row),
      })),
    };
  }
}
