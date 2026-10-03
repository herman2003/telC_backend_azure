import { ExamModelltestsController } from '../src/modules/centers/exam-modelltests.controller';
import { ExamModelltestsService } from '../src/modules/centers/exam-modelltests.service';
import { CenterAuthGuard } from '../src/modules/centers/guards/center-auth.guard';
import type { CenterAccessTokenPayload } from '../src/shared/interfaces/token-payload.interface';

describe('ExamModelltestsController', () => {
  const user: CenterAccessTokenPayload = {
    type: 'access',
    actorType: 'CENTER_USER',
    centerUserId: 'owner-1',
    centerId: 'center-1',
    deviceId: 'device-1',
    sessionId: 'session-1',
  };

  it('protects the catalogue with center authentication', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ExamModelltestsController,
    ) as unknown[];

    expect(guards).toContain(CenterAuthGuard);
  });

  it('lists Modelltests for the signed center', async () => {
    const catalogue = {
      list: jest.fn().mockResolvedValue([{ number: 1, title: 'Modelltest 1' }]),
    };
    const controller = new ExamModelltestsController(
      catalogue as unknown as ExamModelltestsService,
    );

    await expect(controller.list(user)).resolves.toEqual([
      { number: 1, title: 'Modelltest 1' },
    ]);
    expect(catalogue.list).toHaveBeenCalledWith(user);
  });
});
