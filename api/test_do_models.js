import fetch from 'node-fetch';
import config from './src/config/index.js';

const apiKey = config.doGradient?.apiKey;

if (!apiKey) {
  console.error('DO_GRADIENT_API_KEY not configured');
  process.exit(1);
}

const response = await fetch('https://inference.do-ai.run/v1/models', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  },
});

const data = await response.json();

console.log('DO Gradient Models:');
if (data.data) {
  const ttsModels = data.data.filter(m => 
    m.id.toLowerCase().includes('tts') || 
    m.id.toLowerCase().includes('audio') || 
    m.id.toLowerCase().includes('speech') ||
    m.id.toLowerCase().includes('eleven')
  );
  
  console.log('\nTTS/Audio models found:', ttsModels.length);
  ttsModels.forEach(m => console.log(`  - ${m.id}`));
  
  console.log('\nAll models:', data.data.map(m => m.id).join('\n  - '));
}
