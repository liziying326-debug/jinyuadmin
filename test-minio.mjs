import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

const BUCKET_NAME = 'jinyu-images';

async function testMinIO() {
  try {
    console.log('正在连接 MinIO...');

    const exists = await minioClient.bucketExists(BUCKET_NAME);
    console.log('连接成功!');
    console.log(`桶 "${BUCKET_NAME}" ${exists ? '已存在' : '不存在'}`);

    if (!exists) {
      console.log('正在创建桶...');
      await minioClient.makeBucket(BUCKET_NAME);
      console.log('桶创建成功!');

      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
          }
        ]
      };

      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log('桶策略设置成功（公开读取）');
    }

    console.log('\n测试上传文件...');
    const testBuffer = Buffer.from('Hello MinIO!');
    const testFileName = `test-${Date.now()}.txt`;

    await minioClient.putObject(BUCKET_NAME, testFileName, testBuffer, testBuffer.length, 'text/plain');

    console.log(`文件 "${testFileName}" 上传成功!`);
    console.log(`URL: http://localhost:9000/${BUCKET_NAME}/${testFileName}`);

    console.log('\n✅ MinIO 配置测试通过!');
  } catch (error) {
    console.error('\n❌ MinIO 测试失败:', error.message);
    process.exit(1);
  }
}

testMinIO();
