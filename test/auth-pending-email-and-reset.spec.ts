/**
 * Pending-email change + email-bound reset.
 *
 * Mocks are `any` (same shape as auth.service.spec). Disabled here so this
 * slice does not raise the repo eslint ratchet; behaviour is still asserted.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService pending email and email-bound reset', () => {
  let service: AuthService;
  let prismaMock: any;
  let txMock: any;
  let tokenServiceMock: any;
  let tokenCryptoMock: any;
  let emailServiceMock: any;

  beforeEach(() => {
    txMock = {
      student: { create: jest.fn(), update: jest.fn() },
      deviceSession: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) =>
        callback(txMock),
      ),
      student: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
      deviceSession: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    tokenServiceMock = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      hashRefreshToken: jest.fn().mockResolvedValue('refresh-hash'),
      compareRefreshToken: jest.fn().mockResolvedValue(true),
      verifyRefreshToken: jest.fn(),
    };

    tokenCryptoMock = {
      generateToken: jest.fn().mockReturnValue('raw-verification-token'),
      generateNumericCode: jest.fn().mockReturnValue('123456'),
      hashToken: jest.fn().mockReturnValue('verification-token-hash'),
      isExpired: jest.fn().mockReturnValue(false),
    };

    emailServiceMock = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendExistingAccountVerificationEmail: jest
        .fn()
        .mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prismaMock,
      tokenServiceMock,
      tokenCryptoMock,
      emailServiceMock,
      { forStudent: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('register returns generic success when email is another pending_email', async () => {
    prismaMock.student.findUnique.mockResolvedValueOnce(null);
    prismaMock.student.findFirst.mockResolvedValueOnce({ id: 'other' });

    await expect(
      service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual({ message: 'verification email sent' });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('verifyEmail swaps pending_email onto email', async () => {
    prismaMock.student.findFirst.mockResolvedValueOnce({
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'old@example.com',
      email_verified: true,
      pending_email: 'new@example.com',
      email_verification_expires: new Date(Date.now() + 60_000),
    });
    prismaMock.student.update.mockResolvedValueOnce({
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'new@example.com',
      email_verified: true,
      pending_email: null,
    });
    txMock.deviceSession.findFirst.mockResolvedValueOnce(null);
    txMock.deviceSession.count.mockResolvedValueOnce(0);
    txMock.deviceSession.upsert.mockResolvedValueOnce({ id: 'session-1' });
    prismaMock.deviceSession.update.mockResolvedValueOnce(undefined);

    await expect(
      service.verifyEmail({
        token: 'verification-token',
        deviceId: 'device-1',
        deviceName: 'Pixel',
      }),
    ).resolves.toMatchObject({
      student: { email: 'new@example.com', emailVerified: true },
    });

    expect(prismaMock.student.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: {
        email: 'new@example.com',
        pending_email: null,
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      },
    });
  });

  it('verifyEmailPublic applies pending swap without a session', async () => {
    prismaMock.student.findFirst.mockResolvedValueOnce({
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'old@example.com',
      email_verified: true,
      pending_email: 'new@example.com',
      email_verification_expires: new Date(Date.now() + 60_000),
    });
    prismaMock.student.update.mockResolvedValueOnce({
      id: 'student-1',
      email: 'new@example.com',
      pending_email: null,
    });

    await expect(
      service.verifyEmailPublic('raw-token'),
    ).resolves.toEqual({ verified: true });

    expect(tokenServiceMock.generateTokenPair).not.toHaveBeenCalled();
  });

  it('resetPassword looks up by email and token hash', async () => {
    const dto = {
      email: 'john.doe@example.com',
      token: '123456',
      newPassword: 'Newpass1!',
      deviceId: 'device-1',
      deviceName: 'Pixel',
    };
    prismaMock.student.findFirst.mockResolvedValueOnce({
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      password_reset_expires: new Date(Date.now() + 60_000),
    });
    txMock.deviceSession.deleteMany.mockResolvedValueOnce(undefined);
    txMock.student.update.mockResolvedValueOnce({ id: 'student-1' });
    txMock.deviceSession.findFirst.mockResolvedValueOnce(null);
    txMock.deviceSession.count.mockResolvedValueOnce(0);
    txMock.deviceSession.upsert.mockResolvedValueOnce({ id: 'session-1' });

    await service.resetPassword(dto as never);

    expect(prismaMock.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: 'john.doe@example.com',
          password_reset_token: 'verification-token-hash',
        }),
      }),
    );
  });

  it('resetPassword rejects when email and code do not match', async () => {
    prismaMock.student.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.resetPassword({
        email: 'other@example.com',
        token: '123456',
        newPassword: 'Newpass1!',
        deviceId: 'device-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('updateStudentProfile', () => {
    const passwordHash = bcrypt.hashSync('Secret1!', 10);

    it('stores pending email and mails the new address', async () => {
      prismaMock.student.findUnique.mockResolvedValueOnce({
        email: 'old@example.com',
        password_hash: passwordHash,
        pending_email: null,
      });
      prismaMock.student.findFirst.mockResolvedValueOnce(null);
      prismaMock.student.update.mockResolvedValueOnce({
        id: 'student-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'old@example.com',
        email_verified: true,
        pending_email: 'new@example.com',
        level: null,
      });

      const result = await service.updateStudentProfile('student-1', {
        email: 'new@example.com',
        currentPassword: 'Secret1!',
      });

      expect(result.email).toBe('old@example.com');
      expect(result.pending_email).toBe('new@example.com');
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'raw-verification-token',
      );
    });

    it('requires current password when changing email', async () => {
      prismaMock.student.findUnique.mockResolvedValueOnce({
        email: 'old@example.com',
        password_hash: passwordHash,
        pending_email: null,
      });

      await expect(
        service.updateStudentProfile('student-1', {
          email: 'new@example.com',
        }),
      ).rejects.toMatchObject({
        response: { message: 'CURRENT_PASSWORD_REQUIRED' },
      });
    });

    it('rejects a wrong current password', async () => {
      prismaMock.student.findUnique.mockResolvedValueOnce({
        email: 'old@example.com',
        password_hash: passwordHash,
        pending_email: null,
      });

      await expect(
        service.updateStudentProfile('student-1', {
          email: 'new@example.com',
          currentPassword: 'Wrong1!',
        }),
      ).rejects.toMatchObject({
        response: { message: 'CURRENT_PASSWORD_INVALID' },
      });
    });

    it('rejects email already used or pending elsewhere', async () => {
      prismaMock.student.findUnique.mockResolvedValueOnce({
        email: 'old@example.com',
        password_hash: passwordHash,
        pending_email: null,
      });
      prismaMock.student.findFirst.mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.updateStudentProfile('student-1', {
          email: 'taken@example.com',
          currentPassword: 'Secret1!',
        }),
      ).rejects.toMatchObject({
        response: { message: 'PROFILE_UPDATE_FAILED' },
      });
    });
  });
});
