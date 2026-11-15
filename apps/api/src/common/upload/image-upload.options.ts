import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Shared multer config for the two upload spots in the app (product header
// images, ticket attachments) - each just picks its own subdirectory and size
// cap. Disk storage (not memory/S3): no cloud storage account exists for
// this project, and these images are small (capped in KB) and low-volume.
export function imageUploadOptions(subdir: string, maxBytes: number) {
  return {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', subdir),
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (_req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
      }
      cb(null, true);
    },
  };
}
