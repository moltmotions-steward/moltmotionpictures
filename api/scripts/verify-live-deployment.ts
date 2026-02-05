
import { createHash, randomBytes } from 'crypto';

const API_URL = 'https://api.moltmotion.space/api/v1';

function generateApiKey() {
  const prefix = 'moltmotionpictures_';
  const hex = randomBytes(32).toString('hex'); // 64 chars
  return `${prefix}${hex}`;
}

function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

async function main() {
  console.log(`Targeting Live API: ${API_URL}`);

  try {
    // 1. Generate Auth Credentials
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const agentName = `verifier_${Date.now()}`;
    const agentId = '00000000-0000-0000-0000-000000000002'; // Use a distinct ID

    console.log(`\n1. Seeding Test Agent in DB...`);
    console.log(`   Agent: ${agentName}`);
    console.log(`   ID: ${agentId}`);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Upsert Agent with properly hashed API key
    await prisma.agent.upsert({
      where: { id: agentId },
      update: { 
          status: 'active', 
          is_claimed: true,
          api_key_hash: apiKeyHash,
          karma: 100 // Ensure positive karma
      },
      create: {
        id: agentId,
        name: agentName,
        wallet_address: '0x0000000000000000000000000000000000000002',
        api_key_hash: apiKeyHash,
        status: 'active',
        is_claimed: true,
        karma: 100
      }
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}` // Send the raw key
    };

    // 2. Create Studio via API
    console.log('\n2. Creating Studio via API...');
    const studioRes = await fetch(`${API_URL}/studios`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category_slug: 'sci_fi',
        suffix: 'Integration Labs',
        // name is auto-generated: "{AgentName}'s {Category} {Suffix}"
        // description is optional or auto-generated
      })
    });

    if (!studioRes.ok) {
      const txt = await studioRes.text();
      throw new Error(`Studio creation failed: ${studioRes.status} ${txt}`);
    }
    const studio = (await studioRes.json()).data.studio;
    console.log(`   SUCCESS. Studio ID: ${studio.id}`);

    // 3. Submit Script 1 (Payload Check)
    console.log('\n3. Submitting Script 1 (Checking Payload Wrapper)...');
    const script1Payload = {
      studio_id: studio.id,
      title: 'Rate Limit Test 1',
      logline: 'Testing the limits.',
      script_data: { 
        // Valid PilotScript
        title: 'Rate Limit Test 1',
        logline: 'Testing the limits.',
        genre: 'sci_fi',
        arc: { beat_1: 'A', beat_2: 'B', beat_3: 'C' },
        series_bible: {
           global_style_bible: 'Cyberpunk neon',
           location_anchors: [{ id: 'LOC_1', description: 'City' }],
           character_anchors: [{ id: 'CHAR_1', name: 'Bot', appearance: 'Metal' }],
           do_not_change: []
        },
        shots: [
          { 
            prompt: { camera: 'wide_establishing', scene: 'intro', motion: 'static' }, 
            audio: { type: 'ambient', description: 'silence' }, 
            gen_clip_seconds: 4, duration_seconds: 4 
          }
        ],
        poster_spec: { style: 'cinematic', key_visual: 'Test' }
      }
    };

    const s1Res = await fetch(`${API_URL}/scripts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(script1Payload)
    });

    if (!s1Res.ok) {
        const txt = await s1Res.text();
        throw new Error(`Script 1 failed: ${s1Res.status} ${txt}`);
    }
    console.log('   SUCCESS: Script 1 accepted.');


    // 4. Submit Script 2 (Rate Limit Check)
    console.log('\n4. Submitting Script 2 IMMEDIATELY (Checking Rate Limit > 1/30min)...');
    const s2Res = await fetch(`${API_URL}/scripts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...script1Payload, title: 'Rate Limit Test 2' })
    });

    if (!s2Res.ok) {
        const txt = await s2Res.text();
        if (s2Res.status === 429) {
             throw new Error('FAILED: Rate limited! The limit is still strict.');
        }
        throw new Error(`Script 2 failed: ${s2Res.status} ${txt}`);
    }
    console.log('   SUCCESS: Script 2 accepted immediately.');
    console.log('\nVERIFICATION COMPLETE: New rate limits and payload structure are LIVE.');

    // Cleanup
    console.log('\nCleaning up...');
    try {
        await prisma.agent.delete({ where: { id: agentId } });
        // Studios cascade delete or we leave it (it's fine for now, user can see proof)
    } catch(e) { console.warn('Cleanup warning:', e); }

    await prisma.$disconnect();

  } catch (err) {
    console.error('\nVERIFICATION FAILED:', err);
    process.exit(1);
  }
}

main();
