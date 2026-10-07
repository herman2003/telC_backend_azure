import { ModelltestOfTheWeekController } from './modelltest-of-the-week.controller';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../../shared/guards/prep-pass.guard';

const mockService = {
  getOfTheWeek: jest.fn(),
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

    const result = await controller.getOfTheWeek();

    expect(mockService.getOfTheWeek).toHaveBeenCalledTimes(1);
    expect(result).toBe(payload);
  });
});
