#!/usr/bin/env ts-node
/**
 * Test script for Modal video generation integration
 * 
 * Usage: npx ts-node scripts/test-modal-integration.ts
 */

import { ModalVideoClient } from '../src/services/ModalVideoClient';

async function main() {
  console.log('🎬 Testing Modal Video Integration\n');
  
  const client = new ModalVideoClient();
  
  // Test 1: Health Check
  console.log('1. Testing health endpoint...');
  try {
    const health = await client.healthCheck();
    console.log('   ✅ Health check passed:', health);
  } catch (error) {
    console.error('   ❌ Health check failed:', error);
    process.exit(1);
  }
  
  // Test 2: Video Generation (optional - uses GPU credits)
  const shouldGenerateVideo = process.argv.includes('--generate');
  
  if (shouldGenerateVideo) {
    console.log('\n2. Testing video generation (this will use GPU credits)...');
    console.log('   ⏳ Generating video... (this may take 30-60 seconds on cold start)');
    
    const startTime = Date.now();
    try {
      const result = await client.generateVideo({
        prompt: 'A cinematic shot of a sunrise over mountains, golden hour lighting, 4K quality',
        seed: 42,
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✅ Video generated in ${elapsed}s`);
      console.log(`   📊 Resolution: ${result.width}x${result.height}`);
      console.log(`   🎞️ Frames: ${result.num_frames}`);
      console.log(`   📦 Video data size: ${(result.video_base64.length / 1024 / 1024).toFixed(2)} MB (base64)`);
      
      // Optionally save to file
      if (process.argv.includes('--save')) {
        const fs = await import('fs');
        const buffer = Buffer.from(result.video_base64, 'base64');
        const filename = `test-video-${Date.now()}.mp4`;
        fs.writeFileSync(filename, buffer);
        console.log(`   💾 Saved to: ${filename}`);
      }
    } catch (error) {
      console.error('   ❌ Video generation failed:', error);
      process.exit(1);
    }
  } else {
    console.log('\n2. Skipping video generation (use --generate to test, uses GPU credits)');
  }
  
  console.log('\n✅ Modal integration test complete!');
}

main().catch(console.error);
