import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';
import { CLOUDINARY } from 'src/constants/cloudinary';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        {
          provide: CLOUDINARY,
          useValue: {
            uploader: { upload_stream: jest.fn() },
            api: { delete_resources: jest.fn() },
            utils: { api_sign_request: jest.fn().mockReturnValue('sig') },
            config: jest.fn().mockReturnValue({
              api_secret: 'secret',
              cloud_name: 'cloud',
              api_key: 'key',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
