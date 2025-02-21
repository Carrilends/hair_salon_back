import { Request } from 'express';
import { v4 as uuid } from 'uuid';

export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file) return callback(new Error('No file provided'), false);
  if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
    callback(null, true);
  } else {
    callback(new Error('File not allowed'), false);
  }
};

export const fileNamer = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, nameFile: string) => void,
) => {
  if (!file) return callback(new Error('No file provided'), '');
  const fileExtension = file.originalname.split('/')[1];
  const fileName = `${uuid()}.${fileExtension}`;
  callback(null, fileName);
};
