import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export const multerPhotoConfig = {
  storage: diskStorage({
    destination: './uploads/profiles',
    filename: (_req: any, file, cb) => {
      const userId = _req.user?.userId || 'unknown';
      const ext = extname(file.originalname).toLowerCase();
      const filename = `user-${userId}-${Date.now()}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /\.(jpg|jpeg|png|webp)$/i;
    if (!allowed.test(extname(file.originalname))) {
      return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
};
