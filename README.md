# Anime Rich Meta

This tool enriches AniList anime entries with higher quality artwork than AniList normally provides. It pairs AniList IDs with high-resolution posters, backdrops, and transparent clearart logos sourced from TMDB, saving the results to a version-controlled `mappings.json` file.

## Why

To facilitate the development of my otaku app by enriching AniList entries with higher quality artwork (high-resolution posters, textless backdrops, and clearart logos).

## What is in this project

- **AniList Scraper** (`scripts/scraper.ts`): Queries AniList's public GraphQL API in batches and stores anime records into a local SQLite database (`anime.db`).
- **Web Mapper UI** (`src/`): A browser interface that lets you step through anime, search TMDB, pick the best poster, backdrop, and logo, and save your selection with one click.
- **Mappings Store** (`mappings.json`): A JSON file storing the mapped TMDB image URLs keyed by AniList ID.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your TMDB API read access token in `.env.local`:
   ```env
   TMDB_READ_ACCESS_TOKEN=your_v4_token_here
   ```

3. Fetch anime metadata from AniList:
   ```bash
   npm run scraper
   ```
   This creates and populates `anime.db`.

4. Start the mapping interface:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

## Using the Web Mapper

- **Navigation**: Use the header buttons or the `←` and `→` arrow keys to move between anime.
- **Sorting**: Toggle between popularity order (default) and AniList ID order.
- **Searching TMDB**: The tool suggests matching TMDB titles based on Romaji and English titles, or you can paste a TMDB ID directly.
- **Artwork Selection**:
  - **Posters**: Pick a high-resolution poster.
  - **Backdrops**: Pick a background wallpaper.
  - **Logos**: Select a primary colored logo and optionally a white logo (`clearlogoWhite`).
- **Saving**: Click **Save Selection**. It updates `mappings.json` immediately while keeping you on the current page.

## Output Format (`mappings.json`)

```json
{
  "21": {
    "anilist_id": 21,
    "tmdb_id": 37854,
    "media_type": "tv",
    "poster": "https://image.tmdb.org/t/p/original/aUxkDbrgUu9a8JkI6RPue6iMGUv.jpg",
    "backdrop": "https://image.tmdb.org/t/p/original/xH9RxrHTZtfGXhTEHtgPC3oL0HL.jpg",
    "logo": "https://image.tmdb.org/t/p/original/ur3luprdGZFBlQZzRguvtILY5Ur.png",
    "clearlogoWhite": "https://image.tmdb.org/t/p/original/white_logo.png",
    "updated_at": "2026-11-14T11:22:33.456Z"
  }
}
```

## License

MIT
