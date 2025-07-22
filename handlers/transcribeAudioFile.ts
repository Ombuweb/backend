import { S3NotificationEvent } from '../utils/types';
import {
  createTranscriptionInDynamoDB,
  getAudioFileFromS3,
  createTranscriptionJob,
  updateTranscriptionStatusInDynamoDB,
} from '../utils/transcription';

interface TranscribeAudioFileResponse {
  statusCode: number;
  body: string;
}

// To be triggered by S3 file upload
export const transcribeAudioFile = async (
  event
): Promise<TranscribeAudioFileResponse> => {
  const record = (
    event.Records as S3NotificationEvent
  )[0] as S3NotificationEvent['Records'][0];

  const bucketName = record.s3.bucket.name;
  const fileName = record.s3.object.key;
  console.log(`Processing file 2: ${fileName} from bucket: ${bucketName}`);
  const fileType = fileName.split('.').pop() || 'audio/mpeg'; // Default to 'audio/mpeg' if no extension

  try {
    const audioBuffer = await getAudioFileFromS3(bucketName, fileName);

    await createTranscriptionInDynamoDB(fileName, record.s3.object.size);

    const transcriptionResult = await createTranscriptionJob(
      audioBuffer,
      fileName,
      fileType
    );

    console.log('Transcription result:', transcriptionResult);

    if (transcriptionResult) {
      await updateTranscriptionStatusInDynamoDB(fileName, transcriptionResult);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Transcription job successfully started',
      }),
    };
  } catch (error) {
    console.error('Error during transcription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error during audio transcription',
        error: error.message,
      }),
    };
  }
};
