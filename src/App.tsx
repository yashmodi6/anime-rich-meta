import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimeRecord, AnimeApiResponse, AnimeMapping } from './types';
import { AnimeCard } from './components/AnimeCard';
import { TmdbWorkspace } from './components/TmdbWorkspace';

const numFmt = new Intl.NumberFormat();

export const App: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [sortByPopularity, setSortByPopularity] = useState(true);
  const [currentAnime, setCurrentAnime] = useState<AnimeRecord | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mappings stored in mappings.json
  const [mappings, setMappings] = useState<Record<string, AnimeMapping>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load mappings.json on mount
  const loadMappings = useCallback(async () => {
    try {
      const res = await fetch('/api/mappings');
      if (res.ok) {
        const data = await res.json();
        setMappings(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  // Fetch single anime at currentIndex
  useEffect(() => {
    const controller = new AbortController();

    async function loadItem() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentIndex),
          limit: '1',
          sort: sortByPopularity ? 'popularity' : 'id',
        });

        const res = await fetch(`/api/anime?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to load anime`);
        }

        const data: AnimeApiResponse = await res.json();
        setCurrentAnime(data.items[0] ?? null);
        setTotal(data.total);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load from database');
        }
      } finally {
        setLoading(false);
      }
    }

    loadItem();
    return () => controller.abort();
  }, [currentIndex, sortByPopularity]);

  const handleBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(1, prev - 1));
  }, []);

  const handleForward = useCallback(() => {
    setCurrentIndex((prev) => (prev < total ? prev + 1 : prev));
  }, [total]);

  // Save mapping to /api/mappings (writes directly to mappings.json)
  const handleSaveMapping = async (mapping: AnimeMapping) => {
    if (!currentAnime) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilist_id: currentAnime.id,
          mapping,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to save`);
      }

      setMappings((prev) => ({
        ...prev,
        [String(currentAnime.id)]: mapping,
      }));

      setSaveSuccessMsg(`Saved AniList #${currentAnime.id} to mappings.json!`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard navigation: Left Arrow for Backward, Right Arrow for Forward
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        handleBackward();
      } else if (e.key === 'ArrowRight') {
        handleForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackward, handleForward]);

  const canGoBackward = currentIndex > 1 && !loading;
  const canGoForward = currentIndex < total && !loading;

  const currentMapping = currentAnime ? mappings[String(currentAnime.id)] ?? null : null;

  return (
    <div className="min-h-screen pb-12 w-full">
      {/* Sticky Navigation Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 py-3 px-6 shadow-md w-full">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Backward Button */}
          <button
            type="button"
            disabled={!canGoBackward}
            onClick={handleBackward}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
          >
            <span>←</span>
            <span>Backward</span>
          </button>

          {/* Center Actions (Counter + Sort Toggle + Notifications + Skip) */}
          <div className="flex items-center gap-3">
            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setSortByPopularity((prev) => !prev);
                setCurrentIndex(1);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                sortByPopularity
                  ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="Toggle sorting order between Popularity and ID"
            >
              <span>{sortByPopularity ? '⚡ Popularity' : '# ID Order'}</span>
            </button>

            {total > 0 && (
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
                Anime <strong className="text-zinc-100 font-mono">{numFmt.format(currentIndex)}</strong> of{' '}
                <strong className="text-zinc-100 font-mono">{numFmt.format(total)}</strong>
              </span>
            )}

            {currentMapping && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2 py-0.5 rounded font-medium">
                Mapped ✓
              </span>
            )}

            {saveSuccessMsg && (
              <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs px-2 py-0.5 rounded animate-fade-in">
                {saveSuccessMsg}
              </span>
            )}

            <button
              type="button"
              onClick={handleForward}
              disabled={!canGoForward}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-700 transition cursor-pointer disabled:opacity-30"
            >
              Skip
            </button>
          </div>

          {/* Forward Button */}
          <button
            type="button"
            disabled={!canGoForward}
            onClick={handleForward}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Forward</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* Spacious Main Workspace */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Error Notice */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {total === 0 && !loading ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            SQLite database is empty. Run <code className="text-emerald-400 font-mono">npm run scraper</code> to fetch records.
          </div>
        ) : currentAnime ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left side: Anime Card */}
            <div className="shrink-0">
              <AnimeCard anime={currentAnime} />
            </div>

            {/* Right side: TMDB Image Workspace */}
            <div className="flex-1 min-w-0 w-full">
              <TmdbWorkspace
                key={currentAnime.id}
                anime={currentAnime}
                savedMapping={currentMapping}
                onSave={handleSaveMapping}
                isSaving={isSaving}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-500 text-sm">
            Loading anime details...
          </div>
        )}
      </main>
    </div>
  );
};
