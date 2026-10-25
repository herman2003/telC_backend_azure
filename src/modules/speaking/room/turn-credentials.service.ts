import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  IceServerDto,
  IceServersResponseDto,
} from './dto/ice-servers-response.dto';

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];
const DEFAULT_TTL_SECONDS = 3600;
const CLOUDFLARE_GENERATE_URL =
  'https://rtc.live.cloudflare.com/v1/turn/keys';

type CloudflareIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
};

type CloudflareIceServersResponse = {
  iceServers: CloudflareIceServer[];
};

/**
 * Issues WebRTC ICE servers for the Sprechen Room.
 *
 * Providers (TURN_PROVIDER):
 * - `coturn` (default): local HMAC with `use-auth-secret` — no network call.
 * - `cloudflare`: mints short-lived credentials via Cloudflare Realtime TURN API.
 *
 * When TURN is disabled or unconfigured, returns STUN-only so the endpoint is
 * safe to ship before TURN infra is live. Cloudflare API failures also fall
 * back to STUN-only (logged) so a TURN outage does not block room setup.
 */
@Injectable()
export class TurnCredentialsService {
  private readonly logger = new Logger(TurnCredentialsService.name);

  constructor(private readonly config: ConfigService) {}

  async getIceServers(studentId: string): Promise<IceServersResponseDto> {
    const ttlSeconds =
      Number(this.config.get<string>('TURN_CREDENTIAL_TTL_SECONDS')) ||
      DEFAULT_TTL_SECONDS;

    const enabled = this.config.get<string>('TURN_ENABLED') === 'true';
    if (!enabled) {
      this.logger.warn(
        'TURN disabled or unconfigured — returning STUN-only ICE servers',
      );
      return { iceServers: this.stunOnly(), ttlSeconds };
    }

    const provider =
      this.config.get<string>('TURN_PROVIDER')?.trim().toLowerCase() ||
      'coturn';

    if (provider === 'cloudflare') {
      return this.fromCloudflare(ttlSeconds);
    }

    return this.fromCoturn(studentId, ttlSeconds);
  }

  private stunOnly(): IceServerDto[] {
    const stunUrls =
      this.parseList(this.config.get<string>('STUN_URLS')) ?? DEFAULT_STUN_URLS;
    return stunUrls.map((urls) => ({ urls }));
  }

  private fromCoturn(
    studentId: string,
    ttlSeconds: number,
  ): IceServersResponseDto {
    const iceServers = this.stunOnly();
    const secret = this.config.get<string>('TURN_STATIC_AUTH_SECRET');
    const turnUrls = this.parseList(this.config.get<string>('TURN_URLS')) ?? [];

    if (!secret || turnUrls.length === 0) {
      this.logger.warn(
        'TURN disabled or unconfigured — returning STUN-only ICE servers',
      );
      return { iceServers, ttlSeconds };
    }

    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:${studentId}`;
    const credential = createHmac('sha1', secret)
      .update(username)
      .digest('base64');

    for (const urls of turnUrls) {
      iceServers.push({
        urls,
        username,
        credential,
        credentialType: 'password',
      });
    }

    return { iceServers, ttlSeconds };
  }

  private async fromCloudflare(
    ttlSeconds: number,
  ): Promise<IceServersResponseDto> {
    const keyId = this.config.get<string>('CLOUDFLARE_TURN_KEY_ID')?.trim();
    const apiToken = this.config
      .get<string>('CLOUDFLARE_TURN_API_TOKEN')
      ?.trim();

    if (!keyId || !apiToken) {
      this.logger.warn(
        'TURN_PROVIDER=cloudflare but CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN missing — STUN-only',
      );
      return { iceServers: this.stunOnly(), ttlSeconds };
    }

    try {
      const res = await fetch(
        `${CLOUDFLARE_GENERATE_URL}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: ttlSeconds }),
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Cloudflare TURN mint failed: HTTP ${res.status} ${body.slice(0, 200)}`,
        );
        return { iceServers: this.stunOnly(), ttlSeconds };
      }

      const data = (await res.json()) as CloudflareIceServersResponse;
      const iceServers = this.normalizeCloudflareIceServers(data.iceServers);
      if (iceServers.length === 0) {
        this.logger.error('Cloudflare TURN mint returned empty iceServers');
        return { iceServers: this.stunOnly(), ttlSeconds };
      }

      return { iceServers, ttlSeconds };
    } catch (err) {
      this.logger.error(
        `Cloudflare TURN mint error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { iceServers: this.stunOnly(), ttlSeconds };
    }
  }

  /**
   * Flatten Cloudflare's `urls: string[]` into one DTO per URL (our contract
   * uses `urls: string`). Drop port 53 — browsers block it and it only adds
   * ICE timeouts (Cloudflare docs).
   */
  private normalizeCloudflareIceServers(
    servers: CloudflareIceServer[] | undefined,
  ): IceServerDto[] {
    if (!servers?.length) return [];

    const out: IceServerDto[] = [];
    for (const server of servers) {
      const urlList = Array.isArray(server.urls)
        ? server.urls
        : server.urls
          ? [server.urls]
          : [];

      for (const urls of urlList) {
        if (/:53(?:\?|$)/.test(urls)) continue;
        const entry: IceServerDto = { urls };
        if (server.username) {
          entry.username = server.username;
          entry.credential = server.credential;
          entry.credentialType = server.credentialType ?? 'password';
        }
        out.push(entry);
      }
    }
    return out;
  }

  private parseList(value?: string): string[] | undefined {
    if (!value) return undefined;
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
}
