import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Private file storage (DIG-31 bucket). Keys hold ids only, never names. Files are read back
 * through the API (or 5-minute presigned links), never made public.
 */
export interface FileStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** null when the key does not exist. */
  get(key: string): Promise<Buffer | null>;
}

export class S3FileStore implements FileStore {
  private readonly s3: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.s3 = new S3Client({ region });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
}

/** Local runs and tests. */
export class MemoryFileStore implements FileStore {
  readonly files = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.files.set(key, { body, contentType });
  }

  async get(key: string): Promise<Buffer | null> {
    return this.files.get(key)?.body ?? null;
  }
}
