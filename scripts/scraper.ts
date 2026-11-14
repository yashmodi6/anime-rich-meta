import { setTimeout as sleep } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const ANILIST_URL = 'https://graphql.anilist.co';
const PAGES_PER_REQUEST = 15;
const PER_PAGE = 50;
const MAX_PAGES_PER_CHUNK = 100;
const CHUNK_SIZE = 5000;
const PACING_DELAY_MS = 2000;

interface AniListMedia {
  id: number;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  popularity?: number | null;
  averageScore?: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null };
  coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null };
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: string[];
}

interface PageBlock {
  pageInfo?: { hasNextPage?: boolean };
  media?: AniListMedia[];
}

const MEDIA_FIELDS = `
  id format status episodes popularity averageScore
  startDate { year month day }
  coverImage { extraLarge large medium }
  title { romaji english native }
  synonyms
`.trim();

// Initialize SQLite database
const db = new DatabaseSync(path.resolve(process.cwd(), 'anime.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS anilist (
    id INTEGER PRIMARY KEY,
    title_romaji TEXT,
    title_english TEXT,
    title_native TEXT,
    synonyms TEXT,
    poster_url TEXT,
    air_date TEXT,
    episodes INTEGER,
    format TEXT,
    status TEXT,
    popularity INTEGER,
    average_score INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_format ON anilist(format);
  CREATE INDEX IF NOT EXISTS idx_status ON anilist(status);
`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO anilist (
    id, title_romaji, title_english, title_native, synonyms,
    poster_url, air_date, episodes, format, status, popularity, average_score
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const formatDate = (s?: AniListMedia['startDate']): string | null => {
  if (!s?.year) return null;
  const parts = [s.year, s.month?.toString().padStart(2, '0'), s.day?.toString().padStart(2, '0')].filter(Boolean);
  return parts.join('-');
};

function saveBatch(items: AniListMedia[]) {
  if (!items.length) return;
  db.exec('BEGIN TRANSACTION;');
  try {
    for (const m of items) {
      const t = m.title ?? {};
      const c = m.coverImage ?? {};
      insertStmt.run(
        m.id,
        t.romaji ?? null,
        t.english ?? null,
        t.native ?? null,
        JSON.stringify(m.synonyms ?? []),
        c.extraLarge ?? c.large ?? c.medium ?? null,
        formatDate(m.startDate),
        m.episodes ?? null,
        m.format ?? null,
        m.status ?? null,
        m.popularity ?? null,
        m.averageScore ?? null
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

async function apiRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  await sleep(PACING_DELAY_MS);
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 60;
    console.warn(`[Rate limited] Backing off for ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return apiRequest<T>(query, variables);
  }

  if (!res.ok) throw new Error(`AniList HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data;
}

async function fetchBatch(idList: number[], startPage: number, numPages: number) {
  const pages = Array.from({ length: numPages }, (_, i) =>
    `p${i}: Page(page: ${startPage + i}, perPage: ${PER_PAGE}) { pageInfo { hasNextPage } media(id_in: $idIn, type: ANIME) { ${MEDIA_FIELDS} } }`
  );

  const data = await apiRequest<Record<string, PageBlock>>(
    `query ($idIn: [Int]) {\n${pages.join('\n')}\n}`,
    { idIn: idList }
  );

  const blocks = Object.values(data);
  const mediaList = blocks.flatMap((b) => b.media ?? []);
  const hasMore = blocks.some((b) => b.pageInfo?.hasNextPage) && mediaList.length > 0;

  return { mediaList, hasMore };
}

async function fetchChunk(startId: number): Promise<number> {
  const endId = startId + CHUNK_SIZE - 1;
  const idList = Array.from({ length: CHUNK_SIZE }, (_, i) => startId + i);
  let page = 1;
  let totalSaved = 0;

  console.log(`\n\x1b[32mSyncing IDs ${startId.toLocaleString()} - ${endId.toLocaleString()}\x1b[0m`);

  while (page <= MAX_PAGES_PER_CHUNK) {
    const batchCount = Math.min(PAGES_PER_REQUEST, MAX_PAGES_PER_CHUNK - page + 1);
    const { mediaList, hasMore } = await fetchBatch(idList, page, batchCount);

    if (mediaList.length) {
      saveBatch(mediaList);
      totalSaved += mediaList.length;
    }

    console.log(`  -> Pages ${page}-${page + batchCount - 1}: +${mediaList.length} anime (Total: ${totalSaved.toLocaleString()})`);
    if (!hasMore || !mediaList.length) break;
    page += batchCount;
  }

  return totalSaved;
}

async function main() {
  console.log('\x1b[36mConnecting to AniList...\x1b[0m');

  const { Page } = await apiRequest<{ Page: { media: [{ id: number }] } }>(
    `query { Page(page: 1, perPage: 1) { media(type: ANIME, sort: ID_DESC) { id } } }`
  );
  const latestId = Page.media[0].id;
  console.log(`\x1b[36mLatest AniList anime ID: ${latestId.toLocaleString()}\x1b[0m`);

  for (let startId = 1; startId <= latestId; startId += CHUNK_SIZE) {
    await fetchChunk(startId);
  }

  console.log('\x1b[32m✓ Sync complete!\x1b[0m');
}

process.on('SIGINT', () => {
  console.log('\n\x1b[33mSync stopped by user (Ctrl+C).\x1b[0m');
  process.exit(0);
});

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
