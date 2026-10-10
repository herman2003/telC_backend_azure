import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

/**
 * Catalogue of student-app download links for the marketing site.
 *
 * Values come from env so CI / CDN URLs can be published without a deploy of
 * the Nest binary shape — empty/missing → null (UI shows “soon”).
 */
@Injectable()
export class VitrineDownloadsService {
  constructor(private readonly config: ConfigService) {}

  list(): DownloadEntry[] {
    const webDefault = 'https://app.lerniqo.tech';

    return [
      {
        id: 'web',
        url: this.optionalUrl('DOWNLOAD_URL_WEB') ?? webDefault,
        version: this.optional('DOWNLOAD_VERSION_WEB'),
        sizeLabel: null,
        minVersion: null,
      },
      {
        id: 'windows',
        url: this.optionalUrl('DOWNLOAD_URL_WINDOWS'),
        version: this.optional('DOWNLOAD_VERSION_WINDOWS'),
        sizeLabel: this.optional('DOWNLOAD_SIZE_WINDOWS'),
        minVersion: this.optional('DOWNLOAD_MIN_WINDOWS'),
      },
      {
        id: 'macos',
        url: this.optionalUrl('DOWNLOAD_URL_MACOS'),
        version: this.optional('DOWNLOAD_VERSION_MACOS'),
        sizeLabel: this.optional('DOWNLOAD_SIZE_MACOS'),
        minVersion: this.optional('DOWNLOAD_MIN_MACOS'),
      },
      {
        id: 'linux',
        url: this.optionalUrl('DOWNLOAD_URL_LINUX'),
        version: this.optional('DOWNLOAD_VERSION_LINUX'),
        sizeLabel: this.optional('DOWNLOAD_SIZE_LINUX'),
        minVersion: this.optional('DOWNLOAD_MIN_LINUX'),
      },
      {
        id: 'android',
        url: this.optionalUrl('DOWNLOAD_URL_ANDROID'),
        version: this.optional('DOWNLOAD_VERSION_ANDROID'),
        sizeLabel: this.optional('DOWNLOAD_SIZE_ANDROID'),
        minVersion: this.optional('DOWNLOAD_MIN_ANDROID'),
      },
    ];
  }

  private optional(key: string): string | null {
    const value = this.config.get<string>(key)?.trim();
    return value && value.length > 0 ? value : null;
  }

  private optionalUrl(key: string): string | null {
    const value = this.optional(key);
    if (!value) return null;
    if (!/^https:\/\//i.test(value)) return null;
    return value;
  }
}
