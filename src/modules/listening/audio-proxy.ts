import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

export type AudioFetcher = (url: string) => Promise<{
  ok: boolean;
  status?: number;
  headers: { get(name: string): string | null | undefined };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/**
 * Fetch bytes from storage and send them to the player.
 *
 * Proxy, never redirect: a redirect would hand the client the CDN URL, which
 * outlives the signed token and can be replayed.
 */
export async function proxyAudioFromUrl(
  fetcher: AudioFetcher,
  audioUrl: string,
  response: Response,
): Promise<void> {
  const upstream = await fetcher(audioUrl);
  if (!upstream.ok) throw new BadRequestException('AUDIO_UNAVAILABLE');

  const body = Buffer.from(await upstream.arrayBuffer());

  response.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'audio/mpeg',
  );
  response.setHeader('Content-Length', String(body.byteLength));
  response.setHeader('Cache-Control', 'no-store, private');
  response.send(body);
}
