import { PartnerCentersService } from './partner-centers.service';

describe('PartnerCentersService', () => {
  const findMany = jest.fn();
  const prisma = { center: { findMany } } as never;
  const service = new PartnerCentersService(prisma);

  beforeEach(() => {
    findMany.mockReset();
  });

  it('returns only centers with logos, mapped for the vitrine', async () => {
    findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Alpha School',
        logo_url: 'https://cdn.lerniqo.tech/center-logos/a.png',
        city_id: 'douala',
        city_other: null,
      },
      {
        id: 'c2',
        name: 'Beta School',
        logo_url: 'https://cdn.lerniqo.tech/center-logos/b.png',
        city_id: null,
        city_other: 'Edea',
      },
    ]);

    await expect(service.listPartners()).resolves.toEqual({
      centers: [
        {
          id: 'c1',
          name: 'Alpha School',
          logoUrl: 'https://cdn.lerniqo.tech/center-logos/a.png',
          city: 'Douala',
        },
        {
          id: 'c2',
          name: 'Beta School',
          logoUrl: 'https://cdn.lerniqo.tech/center-logos/b.png',
          city: 'Edea',
        },
      ],
    });

    expect(findMany).toHaveBeenCalledWith({
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
      take: 50,
    });
  });

  it('returns an empty list when no partners have logos', async () => {
    findMany.mockResolvedValue([]);
    await expect(service.listPartners()).resolves.toEqual({ centers: [] });
  });
});
