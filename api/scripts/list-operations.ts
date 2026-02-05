
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

async function listOperations() {
  const project = 'gen-lang-client-0645888032';
  const location = 'us-central1';
  
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = accessToken.token;

  const base = `https://${location}-aiplatform.googleapis.com/v1beta1`;

  const pathsToCheck = [
    `projects/${project}/locations/${location}/operations`,
    `projects/${project}/locations/${location}/publishers/google/operations`,
    `projects/${project}/locations/${location}/publishers/google/models/veo-3.0-generate-preview/operations`
  ];

  for (const path of pathsToCheck) {
    const url = `${base}/${path}`;
    console.log(`\nChecking: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`Status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Success! Found operations:');
        console.log(JSON.stringify(data, null, 2).slice(0, 500) + '...');
      } else {
        console.log('Error:', await response.text());
      }
    } catch (e) {
      console.log('Request failed:', e);
    }
  }
}

listOperations();
