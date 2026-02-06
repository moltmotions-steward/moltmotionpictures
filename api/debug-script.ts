
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Client-side normalization logic (copied from web-client/src/lib/api.ts)
const normalizeScriptType = (value: unknown): 'text' | 'link' => {
  return value === 'link' ? 'link' : 'text';
};

const normalizeScript = (raw: Record<string, any>) => {
  const author = raw.author || {};
  const studio = raw.studio || {};

  return {
    id: raw.id,
    title: raw.title || '',
    content: raw.content ?? undefined,
    url: raw.url ?? undefined,
    studio:
      (typeof raw.studio === 'string' ? raw.studio : undefined) ||
      studio.name ||
      raw.studio_name ||
      '',
    // ... other fields
    authorId: raw.authorId || raw.author_id || author.id || '',
    authorName: raw.authorName || raw.author_name || author.name || 'unknown',
  };
};

async function main() {
  const title = "The G.U.I.D.E.";
  
  const script = await prisma.script.findFirst({
    where: { title: { contains: "G.U.I.D.E." } },
    include: {
      studio: {
        include: { category: true },
      },
      author: true, // FIXED: Now checking with author included
    }
  });

  if (!script) { console.error("Script not found"); return; }
  const scriptWithRelations = script as any;
  
  // Simulate API Response Construction
  let parsedScriptData = null;
  if (script.script_data) {
     try { parsedScriptData = JSON.parse(script.script_data); } catch (e) {}
  }

  const responseJson = {
    script: {
      id: script.id,
      title: script.title,
      logline: script.logline,
      status: script.pilot_status,
      studio: scriptWithRelations.studio.full_name || scriptWithRelations.studio.name,
      studio_id: scriptWithRelations.studio.id,
      category: scriptWithRelations.studio.category?.slug || null,
      script_data: parsedScriptData,
      score: script.score,
      upvotes: script.upvotes,
      downvotes: script.downvotes,
      user_vote: null,
      submitted_at: script.submitted_at,
      created_at: script.created_at,

      // Author info
      author_id: scriptWithRelations.author.id,
      author_name: scriptWithRelations.author.name,
      author_display_name: scriptWithRelations.author.display_name,
      author_avatar_url: scriptWithRelations.author.avatar_url,
    }
  };

  console.log("Constructed API Response:", JSON.stringify(responseJson, null, 2));

  // Simulate Client Normalization
  try {
      const normalized = normalizeScript(responseJson.script);
      console.log("Normalized Client Object:", normalized);
      
      if (normalized.authorName === 'unknown') {
          console.error("❌ ERROR: Author Name is still 'unknown'!");
      } else {
          console.log("✅ SUCCESS: Author data present:", normalized.authorName);
      }
  } catch (e) {
      console.error("Client Normalization Crashed:", e);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
