import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PushCryptoService } from './push-crypto.service';

@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  constructor(private readonly crypto: PushCryptoService) {}
  private configured = false;
  get enabled() {
    return this.configured;
  }
  get status() {
    return {
      enabled: this.enabled,
      configured: this.configured,
      dryRun: false,
    };
  }
  onModuleInit() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) {
      this.logger.log('Push delivery disabled (inbox remains available)');
      return;
    }
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error('missing project');
      this.crypto.hash('startup-validation');
      const account = JSON.parse(raw) as {
        type?: string;
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (account.project_id !== projectId) throw new Error('project mismatch');
      if (
        account.type !== 'service_account' ||
        typeof account.client_email !== 'string' ||
        !account.client_email ||
        typeof account.private_key !== 'string' ||
        !account.private_key
      )
        throw new Error('incomplete account');
      if (!getApps().some((a) => a.name === 'lerniqo-push')) {
        initializeApp(
          {
            projectId,
            credential: cert({
              projectId: account.project_id,
              clientEmail: account.client_email,
              privateKey: account.private_key,
            }),
          },
          'lerniqo-push',
        );
      }
      this.configured = true;
    } catch {
      // Optional push must not take the account inbox or authentication offline.
      this.configured = false;
      this.logger.error(
        'PUSH_CONFIGURATION_INVALID: provider delivery disabled; inspect deployment secrets',
      );
    }
  }
  async send(
    endpoint: { target_ciphertext: string; locale: string },
    notification: { id: string; kind: string },
    expiresAt: Date,
  ) {
    const locale =
      endpoint.locale === 'fr' ? 'fr' : endpoint.locale === 'en' ? 'en' : 'de';
    const copies = {
      de: [
        'Lerniqo',
        'Eine neue Mitteilung ist verfügbar. Öffne Lerniqo, um sie zu lesen.',
      ],
      fr: [
        'Lerniqo',
        'Une nouvelle notification est disponible. Ouvre Lerniqo pour la consulter.',
      ],
      en: [
        'Lerniqo',
        'A new notification is available. Open Lerniqo to read it.',
      ],
    };
    const [title, body] = copies[locale];
    const app = getApps().find((a) => a.name === 'lerniqo-push');
    if (!app) throw new Error('PUSH_NOT_INITIALIZED');
    const origin = new URL('https://app.lerniqo.tech');
    return getMessaging(app).send(
      {
        token: this.crypto.decrypt(endpoint.target_ciphertext),
        notification: { title, body },
        data: {
          schemaVersion: '1',
          notificationId: notification.id,
          kind: notification.kind,
          action: 'OPEN_NOTIFICATION_INBOX',
        },
        android: {
          priority: 'normal',
          ttl: Math.max(0, expiresAt.getTime() - Date.now()),
          collapseKey: notification.id,
          notification: {
            tag: notification.id,
            channelId: 'lerniqo_notifications',
          },
        },
        apns: {
          headers: {
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-collapse-id': notification.id,
            'apns-expiration': String(Math.floor(expiresAt.getTime() / 1000)),
          },
          payload: { aps: { sound: 'default' } },
        },
        webpush: {
          headers: {
            TTL: String(
              Math.max(
                0,
                Math.floor((expiresAt.getTime() - Date.now()) / 1000),
              ),
            ),
          },
          notification: { tag: notification.id, icon: '/icons/Icon-192.png' },
          fcmOptions: {
            link: new URL('/exam-day/notifications', origin).toString(),
          },
        },
      },
      false,
    );
  }
}
