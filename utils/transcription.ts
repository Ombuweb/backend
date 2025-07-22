import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BatchClient,
  CreateJobResponse,
  RetrieveTranscriptResponse,
} from '@speechmatics/batch-client';
import { MIME_TYPES } from './mime-types';

const dynamoClient = new DynamoDBClient({ region: 'eu-north-1' });
const s3Client = new S3Client({ region: 'eu-north-1' });

async function createTranscriptionJob(
  fileBlob: Blob,
  fileName: string,
  fileType: string
): Promise<ReturnType<typeof BatchClient.prototype.createTranscriptionJob>> {
  const SPEECHMACTICS_API_KEY = process.env.SPEECHMACTICS_API_KEY;
  if (!SPEECHMACTICS_API_KEY) {
    throw new Error('SPEECHMACTICS_API_KEY is not set');
  }
  const client = new BatchClient({
    apiKey: SPEECHMACTICS_API_KEY,
    appId: 'nodeJS-example',
  });

  try {
    const file = new File([fileBlob], fileName, { type: fileType });

    const response = await client.createTranscriptionJob(file, {
      transcription_config: {
        language: 'en',
      },
      tracking: {
        reference: fileName, // Use the file name as a reference
      },
      notification_config: [
        // Callback URL for transcription completion
        {
          url: 'https://4371ec4bd9a5.ngrok-free.app/api/webhook', // local host webhook
          contents: ['transcript', 'data'],
          auth_headers: [
            `Authorization: Bearer ${process.env.CALLBACK_SECRET_TOKEN}`,
          ],
        },
      ],
    });

    console.log('Transcription finished!');

    return response;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

async function getAudioFileFromS3(
  bucketName: string,
  fileName: string
): Promise<Blob> {
  console.log(`Getting audio file from S3: ${bucketName}/${fileName}`);
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  try {
    const fileStream = await s3Client.send(command);
    const fileBuffer: Uint8Array<ArrayBufferLike> | undefined =
      await fileStream.Body?.transformToByteArray();

    if (!fileBuffer) {
      throw new Error('File buffer is empty');
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !MIME_TYPES[fileExtension]) {
      throw new Error(`Unsupported audio file type: ${fileExtension}`);
    }

    const mimeType = MIME_TYPES[fileExtension] || 'application/octet-stream'; // Default to a generic MIME type
    const buffer = Buffer.from(fileBuffer);
    return new Blob([buffer], { type: mimeType });
  } catch (error) {
    console.error('Error getting audio file from S3:', error);
    throw new Error(error.message);
  }
}

async function saveTranscriptionToS3(
  transcriptionResult: string | RetrieveTranscriptResponse,
  fileName: string,
  bucketName: string
): Promise<void> {
  // Save the transcription to S3
  const transcriptionS3Key = `transcriptions/${fileName}.json`;
  const putTranscriptionCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: transcriptionS3Key,
    Body: JSON.stringify(transcriptionResult),
    ContentType: 'application/json',
  });

  try {
    await s3Client.send(putTranscriptionCommand);
  } catch (error) {
    console.error('Error saving transcription to S3:', error);
    throw new Error(error.message);
  }
}

async function createTranscriptionInDynamoDB(
  fileName: string,
  fileSize: number
): Promise<void> {
  // Store transcription in DynamoDB
  const transcriptionTableName = process.env.TRANSCRIPTION_TABLE_NAME;

  const transcriptionItem = {
    userId: fileName.split('/')[0], // Assuming userId is part of the file path
    audioS3Key: fileName,
    audioFileSize: fileSize,
    transcriptionS3Key: `transcriptions/${fileName}.json`, // Assuming transcription will be stored in a 'transcriptions' folder
    status: 'PENDING', // Initial status
    createdAt: new Date().toISOString(),
  };
  // Save transcription item to DynamoDB
  const putCommand = new PutItemCommand({
    TableName: transcriptionTableName,
    Item: {
      userId: { S: transcriptionItem.userId },
      audioS3Key: { S: transcriptionItem.audioS3Key },
      audioFileSize: { N: transcriptionItem.audioFileSize.toString() },
      transcriptionS3Key: { S: transcriptionItem.transcriptionS3Key },
      status: { S: transcriptionItem.status },
      createdAt: { S: transcriptionItem.createdAt },
    },
  });

  try {
    await dynamoClient.send(putCommand);
    console.log('Transcription item saved to DynamoDB:', transcriptionItem);
  } catch (error) {
    console.error('Error creating transcription item to DynamoDB:', error);

    throw new Error(error.message);
  }
}

async function updateTranscriptionStatusInDynamoDB(
  fileName: string,
  transcriptionJob: CreateJobResponse
): Promise<void> {
  const transcriptionTableName = process.env.TRANSCRIPTION_TABLE_NAME;

  const updateCommand = new UpdateItemCommand({
    TableName: transcriptionTableName,
    Key: {
      audioS3Key: { S: fileName },
    },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': { S: JSON.stringify(transcriptionJob) },
    },
  });

  try {
    await dynamoClient.send(updateCommand);
    console.log(`Transcription status updated to ${status} for ${fileName}`);
  } catch (error) {
    console.error('Error updating transcription status:', error);
    throw new Error(error.message);
  }
}

export {
  createTranscriptionJob,
  getAudioFileFromS3,
  saveTranscriptionToS3,
  createTranscriptionInDynamoDB,
  updateTranscriptionStatusInDynamoDB,
};
