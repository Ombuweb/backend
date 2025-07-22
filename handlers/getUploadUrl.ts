import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const getUploadUrl = async (event) => {
  try {
    const { fileName, fileType, userId } = JSON.parse(event.body);

    if (!fileName || !fileType || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'fileName, fileType, and userId are required',
        }),
      };
    }

    const s3Client = new S3Client({ region: 'eu-north-1' });
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${userId}/${fileName}`,
      ContentType: fileType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ uploadUrl: url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message:
          error instanceof Error
            ? 'Error generating upload URL: ' + error.message
            : 'Error generating upload URL: Internal Server Error',
      }),
    };
  }
};
