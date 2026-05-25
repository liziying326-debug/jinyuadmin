import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'jinyu-images';

async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
      console.log(`[MinIO] Bucket "${BUCKET_NAME}" created successfully`);
    }

    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
      }]
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    console.log(`[MinIO] Bucket policy set to public read`);
  } catch (error) {
    console.error('[MinIO] Error ensuring bucket:', error.message);
  }
}

async function uploadToMinIO(fileBuffer, filename, mimetype) {
  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}-${filename}`;

  try {
    await minioClient.putObject(BUCKET_NAME, uniqueFilename, fileBuffer, fileBuffer.length, mimetype);

    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const publicUrl = `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${uniqueFilename}`;

    return { success: true, url: publicUrl, filename: uniqueFilename };
  } catch (error) {
    console.error('[MinIO] Upload error:', error.message);
    return { success: false, error: error.message };
  }
}

async function deleteFromMinIO(filename) {
  try {
    await minioClient.removeObject(BUCKET_NAME, filename);
    return { success: true };
  } catch (error) {
    console.error('[MinIO] Delete error:', error.message);
    return { success: false, error: error.message };
  }
}

const minioModule = {
  minioClient,
  uploadToMinIO,
  deleteFromMinIO,
  ensureBucket,
  BUCKET_NAME
};

export default minioModule;
export { minioClient, uploadToMinIO, deleteFromMinIO, ensureBucket, BUCKET_NAME };