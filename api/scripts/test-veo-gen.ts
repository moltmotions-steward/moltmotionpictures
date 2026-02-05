
import dotenv from 'dotenv';
dotenv.config();

import { VeoClient } from '../src/services/VeoClient';

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (!projectId) {
    console.error('❌ Missing GOOGLE_CLOUD_PROJECT_ID in .env');
    process.exit(1);
  }

  console.log(`Testing Veo Client config:`);
  console.log(`  Project: ${projectId}`);
  console.log(`  Location: ${location}`);

  const client = new VeoClient({
    project: projectId,
    location: location,
  });

  const prompt = "A cinematic drone shot of a futuristic city at sunset, with golden light reflecting off glass skyscrapers. 4k resolution, photorealistic.";
  
  console.log(`\n🚀 Sending generation request...`);
  console.log(`  Prompt: "${prompt}"`);
  console.log(`  With Audio: true`);

  try {
    const result = await client.generateVideo({
      prompt,
      withAudio: true,
      fps: 24,
      aspectRatio: '16:9'
    });

    console.log(`\n✅ Generation Successful!`);
    console.log(`  Video URL: ${result.videoUrl}`);
    console.log(`  Metadata:`, result.metadata);

  } catch (error: any) {
    console.error(`\n❌ Generation Failed:`);
    console.error(error);
    if (error.originalError) {
        console.error('Original Error:', error.originalError);
    }
  }
}

main();
