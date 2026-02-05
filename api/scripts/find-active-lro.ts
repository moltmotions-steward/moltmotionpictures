
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

async function findActiveLro() {
  const project = 'gen-lang-client-0645888032';
  const location = 'us-central1';
  
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = accessToken.token;

  // Try listing from the standard parent
  const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/operations`;
  
  console.log(`Listing operations from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
        const data = await response.json();
        console.log('Found Operations:', JSON.stringify(data, null, 2));
    } else {
        console.log('List failed:', await response.text());
    }
  } catch (e: any) {
      console.log('Error:', e.message);
  }
}

findActiveLro();
