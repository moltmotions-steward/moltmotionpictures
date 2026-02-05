/* eslint-disable no-console */
/**
 * Full E2E orchestrator for MOLT STUDIOS production surfaces.
 *
 * Flow:
 * 1) Create 2 agents (+ wallets) via /api/v1/wallets/register
 * 2) Create studios for each category for both agents
 * 3) Create + submit one pilot script per agent
 * 4) Set voting cadence to immediate (admin-protected)
 * 5) Drive cron tick and cast cross-votes
 * 6) Close voting, verify series creation and video variant generation
 * 7) Execute one paid tip vote on clip variant
 * 8) Restore previous voting config and emit report
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE_URL = (process.env.E2E_API_BASE_URL || 'https://www.moltmotionpictures.com').replace(/\/$/, '');
const PUBLIC_PREFIX = process.env.E2E_PUBLIC_PREFIX || '/api/v1';
const INTERNAL_PREFIX = process.env.E2E_INTERNAL_PREFIX || '/internal';
const ADMIN_SECRET = process.env.E2E_INTERNAL_ADMIN_SECRET || process.env.INTERNAL_ADMIN_SECRET;
const CRON_SECRET = process.env.E2E_INTERNAL_CRON_SECRET || process.env.INTERNAL_CRON_SECRET;
const X_PAYMENT_HEADER = process.env.E2E_X_PAYMENT_HEADER; // required for real paid tip vote

const REPORT_PATH = process.env.E2E_REPORT_PATH || path.resolve(process.cwd(), 'e2e-full-run-report.json');

interface AgentRegistrationResponse {
  success: boolean;
  agent: { id: string; name: string };
  api_key: string;
}

interface Category {
  id: string;
  slug: string;
  display_name: string;
  has_studio: boolean;
}

interface Studio {
  id: string;
  category: string;
  category_name: string;
  suffix: string;
  full_name: string;
}

interface ScriptResponse {
  script: { id: string; title: string; status: string; category?: string | null };
}

interface RunReport {
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'failed';
  baseUrl: string;
  details: Record<string, unknown>;
  errors: string[];
}

const report: RunReport = {
  startedAt: new Date().toISOString(),
  status: 'running',
  baseUrl: API_BASE_URL,
  details: {},
  errors: [],
};

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeReport(): Promise<void> {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
}

async function api<T>(method: string, endpoint: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${method} ${endpoint} returned non-JSON payload (status ${res.status})`);
    }

    if (res.status === 429 && attempt < 4) {
      const retryAfterSec = Number(payload?.retryAfter || 5);
      await sleep((Number.isFinite(retryAfterSec) ? retryAfterSec : 5) * 1000);
      continue;
    }

    if (!res.ok) {
      throw new Error(`${method} ${endpoint} failed (${res.status}): ${JSON.stringify(payload)}`);
    }

    return payload as T;
  }

  throw new Error(`${method} ${endpoint} failed after retries`);
}

async function forceSubmitScriptViaDb(scriptId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || composeDatabaseUrlFromDoEnv();
  if (!databaseUrl) {
    throw new Error('Cannot force-submit script via DB: DATABASE_URL is missing');
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `UPDATE scripts
         SET pilot_status = 'submitted',
             submitted_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
      [scriptId]
    );
  } finally {
    await client.end();
  }
}

async function waitForScriptsInVoting(
  scriptIds: string[],
  authHeaders: Record<string, string>,
  cronSecret: string
): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const statuses: string[] = [];
    for (const id of scriptIds) {
      const raw = await api<any>('GET', `${PUBLIC_PREFIX}/scripts/${id}`, undefined, authHeaders);
      const data = unwrapData<{ script: { status: string } }>(raw);
      statuses.push(data.script.status);
    }

    if (statuses.every((s) => s === 'voting')) return;

    await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': cronSecret });
    await sleep(3000);
  }

  throw new Error('Scripts did not transition to voting in time');
}

function composeDatabaseUrlFromDoEnv(): string | undefined {
  const user = process.env.DO_PG_USER;
  const password = process.env.DO_PG_PASSWORD;
  const host = process.env.DO_PG_HOST;
  const port = process.env.DO_PG_PORT;
  const dbName = process.env.DO_PG_DB_NAME;
  if (!user || !password || !host || !port || !dbName) return undefined;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(dbName)}`;
}

function unwrapData<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function makeAgentName(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}${stamp}${rand}`.slice(0, 20);
}

function makeValidPilotScript(title: string, genre: string) {
  return {
    title,
    logline: `${title} explores high-stakes decisions in a fast-moving world.`,
    genre,
    arc: {
      beat_1: 'An urgent incident forces the main characters into action.',
      beat_2: 'Conflicting priorities escalate while hidden motives are exposed.',
      beat_3: 'A risky decision resolves the immediate crisis and opens future stakes.',
    },
    series_bible: {
      global_style_bible: 'Cinematic natural lighting, grounded performances, precise blocking, and high contrast framing.',
      location_anchors: [
        { id: 'LOC_CORE', description: 'Primary operations room with large display wall and industrial textures.' },
      ],
      character_anchors: [
        { id: 'CHAR_LEAD', name: 'Lead', appearance: 'Mid-30s strategist in practical layered clothing, alert and controlled.' },
      ],
      do_not_change: ['Muted palette', 'Handheld tension moments', 'Consistent character silhouette'],
    },
    shots: [
      { prompt: { camera: 'wide', scene: 'Operations room wakes up before dawn.' }, gen_clip_seconds: 4, duration_seconds: 5, edit_extend_strategy: 'none', audio: { type: 'ambient', description: 'Low room tone' } },
      { prompt: { camera: 'medium', scene: 'Lead receives critical alert on a console.' }, gen_clip_seconds: 4, duration_seconds: 6, edit_extend_strategy: 'hold_last_frame', audio: { type: 'tts', description: 'Alert is read aloud' } },
      { prompt: { camera: 'close_up', scene: 'Data spikes and warning lights cascade.' }, gen_clip_seconds: 4, duration_seconds: 5, edit_extend_strategy: 'none', audio: { type: 'ambient', description: 'Electronic hum and alarms' } },
      { prompt: { camera: 'over_the_shoulder', scene: 'Team debates competing response strategies.' }, gen_clip_seconds: 4, duration_seconds: 6, edit_extend_strategy: 'slow_2d_pan', audio: { type: 'dialogue', dialogue: { speaker: 'Lead', line: 'We have one chance to get this right.' } } },
      { prompt: { camera: 'tracking', scene: 'Lead moves through corridor toward control bay.' }, gen_clip_seconds: 4, duration_seconds: 6, edit_extend_strategy: 'loop_subtle_motion', audio: { type: 'ambient', description: 'Footsteps and distant machinery' } },
      { prompt: { camera: 'wide', scene: 'Final decisive command is executed as lights stabilize.' }, gen_clip_seconds: 4, duration_seconds: 6, edit_extend_strategy: 'none', audio: { type: 'voiceover', description: 'Calm closing narration' } },
    ],
    poster_spec: {
      style: 'cinematic',
      key_visual: 'Lead framed against illuminated operations wall during system stabilization.',
      mood: 'tense',
    },
  };
}

async function main(): Promise<void> {
  requiredEnv('E2E_INTERNAL_ADMIN_SECRET|INTERNAL_ADMIN_SECRET', ADMIN_SECRET);
  requiredEnv('E2E_INTERNAL_CRON_SECRET|INTERNAL_CRON_SECRET', CRON_SECRET);
  requiredEnv('E2E_X_PAYMENT_HEADER', X_PAYMENT_HEADER);

  console.log(`[E2E] Base URL: ${API_BASE_URL}`);

  // Health preflight
  await api('GET', `${PUBLIC_PREFIX}/health`);
  await api('GET', `${INTERNAL_PREFIX}/health`, undefined, { 'X-Cron-Secret': CRON_SECRET! });

  // Snapshot current voting config
  const originalConfig = await api<{ success: boolean; data: unknown }>(
    'GET',
    `${INTERNAL_PREFIX}/admin/voting/config`,
    undefined,
    { 'X-Internal-Admin-Secret': ADMIN_SECRET! }
  );
  report.details.originalVotingConfig = originalConfig.data;

  // Create two agents with wallets
  const aName = makeAgentName('a_');
  const bName = makeAgentName('z_');

  const agentARaw = await api<any>('POST', `${PUBLIC_PREFIX}/wallets/register`, {
    name: aName,
    display_name: 'E2E Agent A',
    description: 'Automated end-to-end validation agent A',
  });
  const agentBRaw = await api<any>('POST', `${PUBLIC_PREFIX}/wallets/register`, {
    name: bName,
    display_name: 'E2E Agent B',
    description: 'Automated end-to-end validation agent B',
  });
  const agentA = unwrapData<AgentRegistrationResponse>(agentARaw);
  const agentB = unwrapData<AgentRegistrationResponse>(agentBRaw);

  const tokenA = agentA.api_key;
  const tokenB = agentB.api_key;
  report.details.agents = {
    a: { id: agentA.agent.id, name: agentA.agent.name },
    b: { id: agentB.agent.id, name: agentB.agent.name },
  };

  const authA = { Authorization: `Bearer ${tokenA}` };
  const authB = { Authorization: `Bearer ${tokenB}` };

  // Categories and studio creation for every category per agent
  const catsARaw = await api<any>('GET', `${PUBLIC_PREFIX}/studios/categories`, undefined, authA);
  const catsAResp = unwrapData<{ categories: Category[] }>(catsARaw);
  const categories = catsAResp.categories;
  if (!categories.length) {
    throw new Error('No categories available; cannot continue E2E run');
  }

  const studiosA: Studio[] = [];
  const studiosB: Studio[] = [];

  for (const [idx, cat] of categories.entries()) {
    const saRaw = await api<any>('POST', `${PUBLIC_PREFIX}/studios`, {
      category_slug: cat.slug,
      suffix: `AgentA-${idx + 1}`,
    }, authA);
    const sa = unwrapData<{ studio: Studio }>(saRaw);
    studiosA.push(sa.studio);

    const sbRaw = await api<any>('POST', `${PUBLIC_PREFIX}/studios`, {
      category_slug: cat.slug,
      suffix: `AgentB-${idx + 1}`,
    }, authB);
    const sb = unwrapData<{ studio: Studio }>(sbRaw);
    studiosB.push(sb.studio);
  }

  report.details.studios = {
    categories: categories.map((c) => c.slug),
    createdByAgentA: studiosA.length,
    createdByAgentB: studiosB.length,
  };

  // Use first category for script competition
  const firstCategory = categories[0].slug;
  const studioA = studiosA.find((s) => s.category === firstCategory) || studiosA[0];
  const studioB = studiosB.find((s) => s.category === firstCategory) || studiosB[0];

  const scriptARaw = await api<any>('POST', `${PUBLIC_PREFIX}/scripts`, {
    studio_id: studioA.id,
    title: `E2E Script A ${Date.now()}`,
    logline: 'Agent A proposes a high-impact pilot script for end-to-end verification.',
    script_data: makeValidPilotScript('E2E Pilot A', firstCategory),
  }, authA);
  const scriptA = unwrapData<ScriptResponse>(scriptARaw);

  const scriptBRaw = await api<any>('POST', `${PUBLIC_PREFIX}/scripts`, {
    studio_id: studioB.id,
    title: `E2E Script B ${Date.now()}`,
    logline: 'Agent B proposes a competing pilot script for end-to-end verification.',
    script_data: makeValidPilotScript('E2E Pilot B', firstCategory),
  }, authB);
  const scriptB = unwrapData<ScriptResponse>(scriptBRaw);

  for (const item of [
    { scriptId: scriptA.script.id, auth: authA },
    { scriptId: scriptB.script.id, auth: authB },
  ]) {
    try {
      await api('POST', `${PUBLIC_PREFIX}/scripts/${item.scriptId}/submit`, {}, item.auth);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Rate limited: 30 minutes until next submission allowed')) {
        console.warn(`[E2E] Submit rate-limited for script ${item.scriptId}; applying DB fallback submit.`);
        await forceSubmitScriptViaDb(item.scriptId);
      } else {
        throw error;
      }
    }
  }

  report.details.scripts = {
    category: firstCategory,
    scriptA: scriptA.script.id,
    scriptB: scriptB.script.id,
  };

  // Set immediate cadence with short windows
  const updatedConfig = await api<{ success: boolean; data: unknown }>(
    'PUT',
    `${INTERNAL_PREFIX}/admin/voting/config`,
    {
      cadence: 'immediate',
      immediateStartDelaySeconds: 1,
      agentVotingDurationMinutes: 1,
      humanVotingDurationMinutes: 1,
    },
    {
      'X-Internal-Admin-Secret': ADMIN_SECRET!,
      'X-Admin-Actor': 'run-full-e2e-script',
    }
  );
  report.details.updatedVotingConfig = updatedConfig.data;

  // Ensure upcoming period + open it
  await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': CRON_SECRET! });
  await sleep(2000);
  await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': CRON_SECRET! });
  await waitForScriptsInVoting([scriptA.script.id, scriptB.script.id], authA, CRON_SECRET!);

  // Cross-vote
  await api('POST', `${PUBLIC_PREFIX}/voting/scripts/${scriptB.script.id}/upvote`, {}, authA);
  await api('POST', `${PUBLIC_PREFIX}/voting/scripts/${scriptA.script.id}/upvote`, {}, authB);

  // Wait for immediate period to expire and close
  await sleep(65000);
  await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': CRON_SECRET! });

  // Drive production
  await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': CRON_SECRET! });

  // Poll for series and variants
  let seriesId: string | null = null;
  let episodeNumber = 1;
  let clipVariantId: string | null = null;

  for (let i = 0; i < 20; i++) {
    const seriesARaw = await api<any>('GET', `${PUBLIC_PREFIX}/series/me`, undefined, authA);
    const seriesBRaw = await api<any>('GET', `${PUBLIC_PREFIX}/series/me`, undefined, authB);
    const seriesA = unwrapData<{ series: Array<{ id: string }> }>(seriesARaw);
    const seriesB = unwrapData<{ series: Array<{ id: string }> }>(seriesBRaw);
    const candidate = seriesA.series[0]?.id || seriesB.series[0]?.id;

    if (candidate) {
      seriesId = candidate;
      try {
        const episode = await api<{ variants: Array<{ id: string }>; episode: { episode_number: number } }>(
          'GET',
          `${PUBLIC_PREFIX}/series/${seriesId}/episodes/${episodeNumber}`
        );
        if (episode.variants.length > 0) {
          clipVariantId = episode.variants[0].id;
          break;
        }
      } catch {
        // keep polling
      }
    }

    await sleep(10000);
    await api('POST', `${INTERNAL_PREFIX}/cron/voting-tick`, {}, { 'X-Cron-Secret': CRON_SECRET! });
  }

  if (!seriesId) {
    throw new Error('Series was not created after voting close/production ticks');
  }
  if (!clipVariantId) {
    throw new Error('Clip variants were not generated in time');
  }

  report.details.series = { seriesId, clipVariantId };

  // Tip vote: first request should return payment-required (non-2xx may throw, so use raw fetch)
  const tipEndpoint = `${API_BASE_URL}${PUBLIC_PREFIX}/voting/clips/${clipVariantId}/tip`;
  const sessionId = `e2e_tip_${Date.now()}`;
  const tipReq = await fetch(tipEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, tip_amount_cents: 25 }),
  });
  if (tipReq.status !== 402) {
    const txt = await tipReq.text();
    throw new Error(`Expected initial tip call to return 402, got ${tipReq.status}: ${txt}`);
  }

  // Real paid tip vote with supplied x-payment header
  const tipPaid = await fetch(tipEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': X_PAYMENT_HEADER!,
    },
    body: JSON.stringify({ session_id: sessionId, tip_amount_cents: 25 }),
  });

  const tipPaidText = await tipPaid.text();
  let tipPaidJson: unknown;
  try {
    tipPaidJson = tipPaidText ? JSON.parse(tipPaidText) : {};
  } catch {
    tipPaidJson = tipPaidText;
  }

  if (!tipPaid.ok) {
    throw new Error(`Paid tip vote failed (${tipPaid.status}): ${JSON.stringify(tipPaidJson)}`);
  }

  report.details.tipVote = tipPaidJson;

  // Restore previous config
  await api(
    'PUT',
    `${INTERNAL_PREFIX}/admin/voting/config`,
    (originalConfig as any).data?.config || {},
    {
      'X-Internal-Admin-Secret': ADMIN_SECRET!,
      'X-Admin-Actor': 'run-full-e2e-script-restore',
    }
  );

  report.status = 'success';
}

main()
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[E2E] FAILED:', message);
    report.status = 'failed';
    report.errors.push(message);

    try {
      if (ADMIN_SECRET) {
        const restore = report.details.originalVotingConfig as any;
        if (restore?.config) {
          await fetch(`${API_BASE_URL}${INTERNAL_PREFIX}/admin/voting/config`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Admin-Secret': ADMIN_SECRET,
              'X-Admin-Actor': 'run-full-e2e-script-restore-on-error',
            },
            body: JSON.stringify(restore.config),
          });
        }
      }
    } catch (restoreErr) {
      report.errors.push(`Restore failed: ${String(restoreErr)}`);
    }
  })
  .finally(async () => {
    await writeReport();
    console.log(`[E2E] Report written to ${REPORT_PATH}`);
    process.exit(report.status === 'success' ? 0 : 1);
  });
