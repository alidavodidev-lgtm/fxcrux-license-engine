import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';

// For arbitrary (non-image) deliverables - e.g. the actual EA/indicator
// installer attached to a product. Unlike imageUploadOptions(), this stores
// files OUTSIDE the uploads/ tree (which is mounted fully public via
// app.useStaticAssets in main.ts) since these downloads must only ever be
// reachable through the license-gated download endpoint, never a static URL.
// No mimetype restriction - admin-only upload, and the files are inherently
// varied binary formats (.zip, .ex5, .mq5, .dll, ...).
export function fileUploadOptions(subdir: string, maxBytes: number) {
  return {
    storage: diskStorage({
      destination: join(process.cwd(), subdir),
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: maxBytes },
  };
}
