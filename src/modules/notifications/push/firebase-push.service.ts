import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PushCryptoService } from './push-crypto.service';

@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  constructor(private readonly crypto: PushCryptoService) {}
  private configured = false;
  get enabled() {
    return process.env.PUSH_ENABLED === 'true' && this.configured;
  }
  get status() {
    return {
      enabled: this.enabled,
      configured: this.configured,
      dryRun: process.env.PUSH_DRY_RUN === 'true',
    };
  }
  onModuleInit() {
    if (process.env.PUSH_ENABLED !== 'true') {
      this.logger.log('Push delivery disabled (inbox remains available)');
      return;
    }
    try {
      if (
        !process.env.FIREBASE_PROJECT_ID ||
        !(
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        )
      )
        throw new Error('missing configuration');
      this.crypto.hash('startup-validation');
      if (!getApps().some((a) => a.name === 'lerniqo-push')) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const account = raw
          ? (JSON.parse(raw) as {
              project_id?: string;
              client_email?: string;
              private_key?: string;
            })
          : null;
        if (account && account.project_id !== process.env.FIREBASE_PROJECT_ID)
          throw new Error('project mismatch');
        initializeApp(
          {
            projectId: process.env.FIREBASE_PROJECT_ID,
            credential: account
              ? cert({
                  projectId: account.project_id,
                  clientEmail: account.client_email,
                  privateKey: account.private_key,
                })
              : applicationDefault(),
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
    const origin = new URL(
      process.env.PUSH_WEB_APP_URL || 'https://app.lerniqo.tech',
    );
    if (origin.protocol !== 'https:' && origin.hostname !== 'localhost')
      throw new Error('PUSH_WEB_ORIGIN_INVALID');
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
      process.env.PUSH_DRY_RUN === 'true',
    );
  }
}
