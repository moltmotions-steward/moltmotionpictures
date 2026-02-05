
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

async function testPoll() {
  const project = 'gen-lang-client-0645888032';
  const location = 'us-central1';
  const opId = 'e46205d2-c770-49d6-9cfb-6879c8645dce'; // The UUID that failed validation
  const fullOpName = `projects/${project}/locations/${location}/publishers/google/models/veo-3.0-generate-preview/operations/${opId}`;

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = accessToken.token;

  const endpoints = [
    // 1. Regional Beta - Standard Operations (Known 400)
    `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/operations/${opId}`,
    
    // 2. Regional Beta - Full Resource Name (Known 404)
    `https://${location}-aiplatform.googleapis.com/v1beta1/${fullOpName}`,
    
    // 3. Regional Beta - Publisher Operations (Guess)
    `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/publishers/google/operations/${opId}`,

    // 4. Regional V1 - Standard Operations
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/operations/${opId}`,

    // 5. Regional V1 - Full Resource Name
    `https://${location}-aiplatform.googleapis.com/v1/${fullOpName}`,
    
    // 6. Global Beta - Standard Operations (Guess)
    `https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/operations/${opId}`,

    // 7. Global Beta - Full Resource Name (Guess)
    `https://aiplatform.googleapis.com/v1beta1/${fullOpName}`
  ];

  console.log(`Testing polling for Op ID: ${opId}`);
  console.log('----------------------------------------');

  for (const url of endpoints) {
    console.log(`\nChecking: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS! Found operation.');
        // console.log(data);
        break; // Stop if found
      } else {
        const text = await response.text();
        console.log(`Error: ${text.slice(0, 200)}...`); // Truncate error
      }
    } catch (e: any) {
      console.log('Request failed:', e.message);
    }
  }
}

testPoll();
