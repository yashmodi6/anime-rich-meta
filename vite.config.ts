import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerResponse } from 'node:http';

const MAPPINGS_FILE = path.resolve(process.cwd(), 'mappings.json');
const TMDB_API_BASE = 'https://api.themoviedb.org/3';

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const getMappings = (): Record<string, any> => {
  if (!fs.existsSync(MAPPINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tmdbToken = (
    env.TMDB_READ_ACCESS_TOKEN ||
    env.TMDB_ACCESS_TOKEN ||
    env.TMDB_TOKEN ||
    ''
  ).trim();

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'sqlite-api-server',
        configureServer(server) {
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
          `);

          // Anime list from SQLite
          server.middlewares.use('/api/anime', (req, res) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
            const limit = Math.min(
              100,
              Math.max(1, parseInt(url.searchParams.get('limit') || '1', 10)),
            );
            const offset = (page - 1) * limit;

            const countResult = db.prepare('SELECT COUNT(*) as count FROM anilist').get() as {
              count: number;
            };
            const total = countResult?.count || 0;
            const sort = url.searchParams.get('sort') || 'popularity';
            const orderBy = sort === 'id' ? 'id ASC' : 'popularity DESC NULLS LAST, id ASC';
            const rows = db
              .prepare(`SELECT * FROM anilist ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
              .all(limit, offset) as any[];

            const items = rows.map((r) => ({
              id: r.id,
              title: {
                romaji: r.title_romaji,
                english: r.title_english,
                native: r.title_native,
              },
              synonyms: r.synonyms ? JSON.parse(r.synonyms) : [],
              posterUrl: r.poster_url,
              airDate: r.air_date,
              episodes: r.episodes,
              format: r.format,
              status: r.status,
              popularity: r.popularity,
              averageScore: r.average_score,
            }));

            sendJson(res, 200, {
              items,
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit) || 1,
            });
          });

          // Mappings API: Read and write mappings.json
          server.middlewares.use('/api/mappings', (req, res) => {
            if (req.method === 'GET') {
              return sendJson(res, 200, getMappings());
            }

            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', () => {
                const { anilist_id, mapping } = JSON.parse(body || '{}');
                if (!anilist_id || !mapping) {
                  return sendJson(res, 400, { error: 'Missing anilist_id or mapping data' });
                }

                const current = getMappings();
                current[String(anilist_id)] = {
                  ...mapping,
                  updated_at: new Date().toISOString(),
                };

                fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
                sendJson(res, 200, { success: true, mapping: current[String(anilist_id)] });
              });
            }
          });

          // TMDB Images Proxy (v4 Read Access Token Bearer Auth)
          server.middlewares.use('/api/tmdb/images', async (req, res) => {
            if (!tmdbToken) {
              return sendJson(res, 500, {
                error: 'TMDB_READ_ACCESS_TOKEN is not set. Please add it to your .env.local file.',
              });
            }

            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const tmdbId = url.searchParams.get('id');
            const mediaType = url.searchParams.get('type') || 'tv';

            if (!tmdbId) {
              return sendJson(res, 400, { error: 'Missing TMDB ID' });
            }

            // Omit include_image_language to fetch all languages + textless images
            const tmdbUrl = `${TMDB_API_BASE}/${mediaType}/${tmdbId}/images`;
            const tmdbRes = await fetch(tmdbUrl, {
              headers: {
                Authorization: `Bearer ${tmdbToken}`,
                Accept: 'application/json',
              },
            });

            if (!tmdbRes.ok) {
              return sendJson(res, tmdbRes.status, {
                error: `TMDB error ${tmdbRes.status}: ${await tmdbRes.text()}`,
              });
            }

            const data = await tmdbRes.json();

            // Language priority: no lang (null / xx) > en > ja > other
            const getPriority = (lang?: string | null) => {
              if (!lang || lang === 'xx') return 0;
              const l = lang.toLowerCase();
              if (l === 'en') return 1;
              if (l === 'ja') return 2;
              return 3;
            };

            const sortImages = (list: any[] = []) =>
              [...list].sort((a, b) => getPriority(a.iso_639_1) - getPriority(b.iso_639_1));

            sendJson(res, 200, {
              posters: sortImages(data.posters),
              backdrops: sortImages(data.backdrops),
              logos: sortImages(data.logos),
            });
          });

          // TMDB Search Proxy (v4 Read Access Token Bearer Auth)
          server.middlewares.use('/api/tmdb/search', async (req, res) => {
            if (!tmdbToken) {
              return sendJson(res, 500, {
                error: 'TMDB_READ_ACCESS_TOKEN is not set. Please add it to your .env.local file.',
              });
            }

            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const query = url.searchParams.get('query') || '';
            const mediaType = url.searchParams.get('type') || 'tv';

            if (!query) {
              return sendJson(res, 400, { error: 'Missing search query' });
            }

            const tmdbUrl = `${TMDB_API_BASE}/search/${mediaType}?query=${encodeURIComponent(query)}`;
            const tmdbRes = await fetch(tmdbUrl, {
              headers: {
                Authorization: `Bearer ${tmdbToken}`,
                Accept: 'application/json',
              },
            });

            const data = await tmdbRes.json();
            sendJson(res, 200, data.results ?? []);
          });
        },
      },
    ],
    server: {
      port: 5173,
      host: true,
    },
  };
});
