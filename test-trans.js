import { BatchClient } from '@speechmatics/batch-client';
import { readFile } from 'fs/promises';
import { File } from 'node:buffer';

const client = new BatchClient({
    apiKey: 'rk6bsj9DtIYsomhw5Ju0jxtk9x4imJRv',
    appId: 'nodeJS-example',
});


const fileName = '/Users/nandesoratjihero/Desktop/test-audio.mp3';

async function createFileObject(filePath) {
    const fileBuffer = await readFile(filePath); // Read the file as a buffer
    const file = new File([fileBuffer], 'test-audio.mp3', { type: 'audio/mpeg' }); // Create a File object
    return file;
}

createFileObject(fileName).then(async (file) => {
    console.log('File object created:', file);
    try {
        const start = performance.now();
        console.log('Starting transcription...');
        const response = await client.transcribe(
            file,
            {
                transcription_config: {
                    language: 'en',
                },
            },
            'json-v2',
        );
        const end = performance.now();
        console.log(`Transcription completed in ${end - start} ms`);
        console.log('Transcription response:', response);
    } catch (error) {
        console.error('Error during transcription:', error);
    }

    console.log('Transcription finished!')
});