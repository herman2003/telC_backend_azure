import { ModelltestOfTheWeekController } from './modelltest-of-the-week.controller';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../../shared/guards/prep-pass.guard';

const mockService = {
  getOfTheWeek: jest.fn(),
  getOfTheWeekContent: jest.fn(),
};

describe('ModelltestOfTheWeekController', () => {
  let controller: ModelltestOfTheWeekController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ModelltestOfTheWeekController(mockService as never);
  });

  it('is Start-gated without Prep Pass', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ModelltestOfTheWeekController,
    ) as unknown[];

    expect(guards).toEqual(
      expect.arrayContaining([JwtAuthGuard, StudentSubscriptionGuard]),
    );
    expect(guards).not.toContain(PrepPassGuard);
  });

  it('GET of-the-week — delegates to service.getOfTheWeek()', async () => {
    const payload = {
      id: 'mt1',
      number: 1,
      title: 'Modelltest 1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-07T23:59:59.999Z',
    };
    mockService.getOfTheWeek.mockResolvedValue(payload);

    const result = await controller.getOfTheWeek({
      studentId: 's1',
      isGuest: false,
    } as never);

    expect(mockService.getOfTheWeek).toHaveBeenCalledWith(expect.any(Date), {
      isGuest: false,
      studentId: 's1',
    });
    expect(result).toBe(payload);
  });

  it('passes isGuest for demo tokens', async () => {
    mockService.getOfTheWeek.mockResolvedValue({
      id: 'mt1',
      number: 1,
      title: 'Modelltest 1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-07T23:59:59.999Z',
    });

    await controller.getOfTheWeek({
      studentId: 'guest',
      isGuest: true,
    } as never);

    expect(mockService.getOfTheWeek).toHaveBeenCalledWith(expect.any(Date), {
      isGuest: true,
      studentId: undefined,
    });
  });

  it('GET of-the-week/content — delegates to getOfTheWeekContent()', async () => {
    const payload = {
      id: 'mt1',
      number: 1,
      title: 'Modelltest 1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-07T23:59:59.999Z',
      sections: {
        LESEN: {},
        SPRACHBAUSTEINE: {},
        HOEREN: [],
        SCHREIBEN: {},
        SPRECHEN: [],
      },
    };
    mockService.getOfTheWeekContent.mockResolvedValue(payload);

    const result = await controller.getOfTheWeekContent({
      studentId: 's1',
      isGuest: false,
    } as never);

    expect(mockService.getOfTheWeekContent).toHaveBeenCalledWith(
      expect.any(Date),
      { isGuest: false, studentId: 's1' },
    );
    expect(result).toBe(payload);
  });

  it('GET of-the-week/content — forwards isGuest for demo tokens', async () => {
    mockService.getOfTheWeekContent.mockRejectedValue(
      new Error('should be refused by service'),
    );

    await expect(
      controller.getOfTheWeekContent({
        studentId: 'guest',
        isGuest: true,
      } as never),
    ).rejects.toThrow('should be refused by service');

    expect(mockService.getOfTheWeekContent).toHaveBeenCalledWith(
      expect.any(Date),
      { isGuest: true, studentId: undefined },
    );
  });
});
