import { BadRequestException } from '@nestjs/common';
import { LesenController } from '../src/modules/lesen/lesen.controller';
import { SprachbausteineController } from '../src/modules/sprachbausteine/sprachbausteine.controller';

describe('Lesen / Sprachbausteine GET teils modelltest query', () => {
  const lesenService = { getTeils: jest.fn().mockResolvedValue([]) };
  const sprachService = { getTeils: jest.fn().mockResolvedValue([]) };
  const lesen = new LesenController(lesenService as never);
  const sprach = new SprachbausteineController(sprachService as never);
  const student = { studentId: 's1', isGuest: false } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Lesen passes modelltest to the service and defaults to 1', async () => {
    await lesen.getTeils(student, '2');
    expect(lesenService.getTeils).toHaveBeenCalledWith('s1', 2);

    await lesen.getTeils(student);
    expect(lesenService.getTeils).toHaveBeenCalledWith('s1', 1);
  });

  it('Sprachbausteine passes modelltest to the service and defaults to 1', async () => {
    await sprach.getTeils(student, '3');
    expect(sprachService.getTeils).toHaveBeenCalledWith('s1', 3);

    await sprach.getTeils(student, undefined);
    expect(sprachService.getTeils).toHaveBeenCalledWith('s1', 1);
  });

  it('rejects a non-integer modelltest query', async () => {
    expect(() => {
      void lesen.getTeils(student, 'abc');
    }).toThrow(BadRequestException);

    await expect(sprach.getTeils(student, 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
