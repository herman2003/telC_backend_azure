import { ModelltestsController } from './modelltests.controller';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

const mockService = {
  getAll: jest.fn(),
  getByNumber: jest.fn(),
};

describe('ModelltestsController', () => {
  let controller: ModelltestsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ModelltestsController(mockService as any);
  });

  it('is protected by JwtAuthGuard at the controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ModelltestsController,
    ) as unknown[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
  });

  it('GET / — delegates to service.getAll() and returns result', async () => {
    const list = [{ id: 'mt1', number: 1, title: 'Modelltest 1' }];
    mockService.getAll.mockResolvedValue(list);

    const result = await controller.getAll({
      studentId: 's1',
      isGuest: false,
    } as never);

    expect(mockService.getAll).toHaveBeenCalledWith({
      isGuest: false,
      studentId: 's1',
    });
    expect(result).toBe(list);
  });

  it('GET /:number — delegates to service.getByNumber(number) and returns result', async () => {
    const detail = {
      id: 'mt1',
      number: 1,
      title: 'Modelltest 1',
      exercises: {
        sprachbausteineT1: ['sb1'],
        sprachbausteineT2: ['sb2'],
        lesenT1: ['l1'],
        lesenT2: ['l2'],
        lesenT3: ['l3'],
      },
    };
    mockService.getByNumber.mockResolvedValue(detail);

    const result = await controller.getByNumber(
      { studentId: 's1', isGuest: false } as never,
      '1',
    );

    expect(mockService.getByNumber).toHaveBeenCalledWith(1, {
      isGuest: false,
      studentId: 's1',
    });
    expect(result).toBe(detail);
  });
});
