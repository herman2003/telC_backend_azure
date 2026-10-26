import { Injectable } from '@nestjs/common';

export type DownloadPlatformId =
  | 'web'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'android';

export type DownloadEntry = {
  id: DownloadPlatformId;
  /** Public HTTPS URL, or null → « bientôt disponible » on the vitrine. */
  url: string | null;
  version: string | null;
  sizeLabel: string | null;
  minVersion: string | null;
};

/** Public R2 CDN for student-app installers (bucket `lerniqo` / `app_platform/`). */
const R2_APP_PLATFORM =
  'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/app_platform';

/**
 * Catalogue of student-app download links for the marketing site.
 * URLs are baked into the service (R2 `app_platform/`); no env required.
 */
@Injectable()
export class VitrineDownloadsService {
  list(): DownloadEntry[] {
    return [
      {
        id: 'web',
        url: 'https://app.lerniqo.tech',
        version: null,
        sizeLabel: null,
        minVersion: null,
      },
      {
        id: 'windows',
        url: `${R2_APP_PLATFORM}/Lerniqo-Setup-Windows-x64.exe`,
        version: '1.0.0',
        sizeLabel: '57 Mo',
        minVersion: 'Windows 10',
      },
      {
        id: 'macos',
        url: `${R2_APP_PLATFORM}/Lerniqo.app.zip`,
        version: '1.0.0',
        sizeLabel: '76 Mo',
        minVersion: null,
      },
      {
        id: 'linux',
        url: `${R2_APP_PLATFORM}/Lerniqo-1.0.0-x86_64.AppImage`,
        version: '1.0.0',
        sizeLabel: '64 Mo',
        minVersion: null,
      },
      {
        id: 'android',
        url: `${R2_APP_PLATFORM}/app-release.apk`,
        version: '1.0.0',
        sizeLabel: '139 Mo',
        // Flutter app minSdk 24 → Android 7.0
        minVersion: '7.0',
      },
    ];
  }
}
