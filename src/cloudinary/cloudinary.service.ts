import { Inject, Injectable } from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as CloudinaryV2,
} from 'cloudinary';
import toStream from 'buffer-to-stream';
import { CLOUDINARY } from 'src/constants/cloudinary';

type SignParams = {
  folder?: string;
  public_id?: string;
  eager?: string[]; // p.ej. ['c_fill,w_400,h_400|jpg']
  tags?: string[];
  overwrite?: boolean;
};

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private cloudinary: typeof CloudinaryV2) {}

  async uploadImage(
    file: Express.Multer.File,
    options?: { folder?: string; public_id?: string },
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        { folder: options?.folder, public_id: options?.public_id },
        (error, result) => (error ? reject(error) : resolve(result!)),
      );
      toStream(file.buffer).pipe(upload);
    });
  }

  /**
   * Genera signature para subidas firmadas desde el front.
   * Sólo firma parámetros que tú controles (whitelist) para no exponer el api_secret.
   */
  generateSignature(params: SignParams = {}) {
    const timestamp = Math.floor(Date.now() / 1000);

    // Construye el payload que SÍ vas a firmar (evita aceptar params arbitrarios del cliente)
    const toSign: Record<string, any> = { timestamp };

    if (params.folder) toSign.folder = params.folder;
    if (params.public_id) toSign.public_id = params.public_id;
    if (params.tags?.length) toSign.tags = params.tags.join(',');

    // `eager` en formato "transform1|format,transform2|format"
    if (params.eager?.length) toSign.eager = params.eager.join(',');

    if (typeof params.overwrite === 'boolean')
      toSign.overwrite = params.overwrite;

    const apiSecret = this.cloudinary.config().api_secret as string;
    const signature = this.cloudinary.utils.api_sign_request(toSign, apiSecret);

    return {
      signature,
      timestamp,
      cloudName: this.cloudinary.config().cloud_name,
      api_key: this.cloudinary.config().api_key,
      // re-envía también los params firmados para que el front los use tal cual
      ...toSign,
    };
  }

  async deleteAssets(publicIds: string[]) {
    return await this.cloudinary.api.delete_resources(publicIds);
  }
}
