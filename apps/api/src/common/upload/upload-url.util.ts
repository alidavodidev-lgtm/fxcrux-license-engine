import { ConfigService } from '@nestjs/config';

// Use the API origin so portals on a different origin can load images.
export function publicUploadUrl(configService: ConfigService, subdir: string, filename: string): string {
  const base = configService.get<string>('PUBLIC_BACKEND_URL', 'http://127.0.0.1:3000');
  return `${base.replace(/\/$/, '')}/uploads/${subdir}/${filename}`;
}

// Accepts either the new absolute URL or a legacy relative one (from before
// this fix) and returns the path under the uploads root for on-disk
// deletion, or null if it isn't a locally-hosted upload at all (e.g. an
// externally pasted image URL).
export function localUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/uploads/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx);
}
