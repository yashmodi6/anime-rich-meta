import React, { useState, useEffect } from 'react';
import { AnimeRecord, TmdbImageNode, TmdbImagesResult, AnimeMapping } from '../types';

const TMDB_IMG_THUMB = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

const toPath = (val?: string | null) => (val ? val.replace(/^https?:\/\/[^/]+\/t\/p\/[^/]+/, '') : null);

const getLangPriority = (lang?: string | null) => {
  if (!lang || lang === 'xx') return 0;
  const l = lang.toLowerCase();
  if (l === 'en') return 1;
  if (l === 'ja') return 2;
  return 3;
};

const sortImages = (list: TmdbImageNode[] = []) =>
  [...list].sort((a, b) => getLangPriority(a.iso_639_1) - getLangPriority(b.iso_639_1));

const LangBadge: React.FC<{ lang?: string | null }> = ({ lang }) => {
  const isNoLang = !lang || lang === 'xx';
  const l = lang?.toLowerCase();
  const color = isNoLang
    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
    : l === 'en'
    ? 'bg-blue-950 text-blue-300 border-blue-700'
    : l === 'ja'
    ? 'bg-purple-950 text-purple-300 border-purple-700'
    : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border shadow-sm uppercase leading-tight ${color}`}>
      {isNoLang ? 'no lang' : lang}
    </span>
  );
};

interface Props {
  anime: AnimeRecord;
  savedMapping: AnimeMapping | null;
  onSave: (mapping: AnimeMapping) => void;
  isSaving: boolean;
}

export const TmdbWorkspace: React.FC<Props> = ({ anime, savedMapping, onSave, isSaving }) => {
  const [tmdbId, setTmdbId] = useState<string>('');
  const [mediaType, setMediaType] = useState<'tv' | 'movie'>('tv');
  const [activeTab, setActiveTab] = useState<'posters' | 'backdrops' | 'logos'>('posters');

  const [images, setImages] = useState<TmdbImagesResult>({ posters: [], backdrops: [], logos: [] });
  const [selectedPoster, setSelectedPoster] = useState<string | null>(null);
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedLogoWhite, setSelectedLogoWhite] = useState<string | null>(null);
  const [logoTarget, setLogoTarget] = useState<'primary' | 'white'>('primary');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMapped, setShowMapped] = useState(false);

  // Search popup / list
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Reset or initialize state when anime changes or savedMapping exists
  useEffect(() => {
    setShowMapped(false);
    const isMovie = anime.format === 'MOVIE';
    setMediaType(isMovie ? 'movie' : 'tv');

    if (savedMapping) {
      setTmdbId(String(savedMapping.tmdb_id));
      setMediaType(savedMapping.media_type);
      setSelectedPoster(toPath(savedMapping.poster));
      setSelectedBackdrop(toPath(savedMapping.backdrop));
      setSelectedLogo(toPath(savedMapping.logo));
      setSelectedLogoWhite(toPath(savedMapping.clearlogoWhite || (savedMapping as any).clearlogo_white));
    } else {
      setTmdbId('');
      setSelectedPoster(null);
      setSelectedBackdrop(null);
      setSelectedLogo(null);
      setSelectedLogoWhite(null);
      setImages({ posters: [], backdrops: [], logos: [] });
    }
    setSearchResults([]);
    setError(null);
  }, [anime.id, savedMapping]);

  // Fetch TMDB images for given TMDB ID
  const fetchTmdbImages = async (idToFetch?: string, typeToFetch?: 'tv' | 'movie') => {
    const id = idToFetch || tmdbId.trim();
    const type = typeToFetch || mediaType;
    if (!id) {
      setError('Please enter a valid TMDB ID');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ id, type });
      const res = await fetch(`/api/tmdb/images?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to fetch TMDB images (HTTP ${res.status})`);
      }
      setImages({
        posters: sortImages(data.posters || []),
        backdrops: sortImages(data.backdrops || []),
        logos: sortImages(data.logos || []),
      });
    } catch (err: any) {
      setError(err?.message || 'Error fetching images');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search TMDB by title
  const handleSearch = async () => {
    const query = anime.title.romaji || anime.title.english || '';
    if (!query) {
      setError('No title available to search');
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        query,
        type: mediaType,
      });
      const res = await fetch(`/api/tmdb/search?${params.toString()}`);
      const list = await res.json();
      if (!res.ok) {
        throw new Error(list.error || 'Failed to search TMDB');
      }
      setSearchResults(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to search TMDB');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const newId = String(result.id);
    setTmdbId(newId);
    setSearchResults([]);
    fetchTmdbImages(newId, mediaType);
  };

  const handleSaveMapping = () => {
    const idNum = parseInt(tmdbId.trim(), 10);
    if (!idNum) {
      setError('Please enter a valid TMDB ID before saving');
      return;
    }

    onSave({
      anilist_id: anime.id,
      tmdb_id: idNum,
      media_type: mediaType,
      poster: selectedPoster ? `${TMDB_IMG_ORIGINAL}${selectedPoster}` : null,
      backdrop: selectedBackdrop ? `${TMDB_IMG_ORIGINAL}${selectedBackdrop}` : null,
      logo: selectedLogo ? `${TMDB_IMG_ORIGINAL}${selectedLogo}` : null,
      clearlogoWhite: selectedLogoWhite ? `${TMDB_IMG_ORIGINAL}${selectedLogoWhite}` : null,
    });
  };

  const currentPoster = selectedPoster
    ? `${TMDB_IMG_THUMB}${selectedPoster}`
    : savedMapping?.poster || null;
  const currentBackdrop = selectedBackdrop
    ? `${TMDB_IMG_THUMB}${selectedBackdrop}`
    : savedMapping?.backdrop || null;
  const currentLogo = selectedLogo
    ? `${TMDB_IMG_THUMB}${selectedLogo}`
    : savedMapping?.logo || null;
  const currentLogoWhite = selectedLogoWhite
    ? `${TMDB_IMG_THUMB}${selectedLogoWhite}`
    : savedMapping?.clearlogoWhite || (savedMapping as any)?.clearlogo_white || null;
  const hasAnyMapped = Boolean(currentPoster || currentBackdrop || currentLogo || currentLogoWhite || savedMapping);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5 shadow-lg w-full">
      {/* TMDB Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            TMDB Image Mapper
            {savedMapping && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-normal px-2 py-0.5 rounded">
                Mapped ✓
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select poster, backdrop/background, and clearart logos for AniList #{anime.id}.
          </p>
        </div>

        {/* Selected Previews Summary & Save Button */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 text-[11px] hidden sm:inline">
            Selected: {selectedPoster ? 'Poster ✓' : '-'} | {selectedBackdrop ? 'Backdrop ✓' : '-'} | {selectedLogo ? 'Logo ✓' : '-'} | {selectedLogoWhite ? 'White Logo ✓' : '-'}
          </span>
          <button
            type="button"
            onClick={handleSaveMapping}
            disabled={isSaving || !tmdbId.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSaving ? 'Saving...' : 'Save Selection'}
          </button>
        </div>
      </div>

      {/* TMDB ID & Search Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 w-64">
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'tv' | 'movie')}
            className="bg-zinc-950 border border-zinc-700 text-xs rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
          >
            <option value="tv">TV</option>
            <option value="movie">Movie</option>
          </select>
          <input
            type="text"
            value={tmdbId}
            onChange={(e) => setTmdbId(e.target.value)}
            placeholder="TMDB ID..."
            className="flex-1 bg-zinc-950 border border-zinc-700 text-xs rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        <button
          type="button"
          onClick={() => fetchTmdbImages()}
          disabled={loading || !tmdbId.trim()}
          className="bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Fetching...' : 'Fetch Images'}
        </button>

        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1.5 rounded border border-zinc-700 transition cursor-pointer disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search by Title'}
        </button>
      </div>

      {/* Search Candidates Dropdown / Grid */}
      {searchResults.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
          <span className="text-xs text-zinc-400 font-medium block">Select matching TMDB title:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectSearchResult(r)}
                className="text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2 rounded flex items-center gap-2 transition cursor-pointer"
              >
                {r.poster_path ? (
                  <img src={`${TMDB_IMG_THUMB}${r.poster_path}`} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-8 h-12 bg-zinc-800 rounded shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-200 truncate">{r.name || r.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    ID: {r.id} ({r.first_air_date || r.release_date || 'N/A'})
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-xs px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Currently Mapped Images (Collapsed by default, large clean view) */}
      {hasAnyMapped && (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setShowMapped(!showMapped)}
            className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-zinc-900 transition cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-zinc-200">Mapped Assets</span>
              <span className="text-[11px] text-zinc-500">
                {[currentPoster && 'Poster', currentBackdrop && 'Backdrop', currentLogo && 'Logo', currentLogoWhite && 'White Logo'].filter(Boolean).join(' • ')}
              </span>
            </div>
            <span className="text-zinc-400 text-xs font-mono">
              {showMapped ? 'Hide ▲' : 'Show ▼'}
            </span>
          </button>

          {showMapped && (
            <div className="p-3 border-t border-zinc-800 flex items-center gap-4 overflow-x-auto">
              {currentPoster && (
                <div className="relative shrink-0 group">
                  <img
                    src={currentPoster}
                    alt="Mapped Poster"
                    className="h-64 aspect-[2/3] object-cover rounded-lg shadow-lg"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-zinc-200 px-2 py-0.5 rounded">
                    Poster
                  </span>
                </div>
              )}
              {currentBackdrop && (
                <div className="relative shrink-0 group">
                  <img
                    src={currentBackdrop}
                    alt="Mapped Backdrop"
                    className="h-64 aspect-video object-cover rounded-lg shadow-lg"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-zinc-200 px-2 py-0.5 rounded">
                    Backdrop
                  </span>
                </div>
              )}
              {currentLogo && (
                <div className="relative shrink-0 group h-64 aspect-video bg-zinc-900/90 rounded-lg p-4 flex items-center justify-center border border-zinc-800 shadow-lg">
                  <img
                    src={currentLogo}
                    alt="Mapped Logo"
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-zinc-200 px-2 py-0.5 rounded">
                    Logo
                  </span>
                </div>
              )}
              {currentLogoWhite && (
                <div className="relative shrink-0 group h-64 aspect-video bg-zinc-900/90 rounded-lg p-4 flex items-center justify-center border border-zinc-800 shadow-lg">
                  <img
                    src={currentLogoWhite}
                    alt="Mapped White Logo"
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-[11px] font-semibold text-zinc-200 px-2 py-0.5 rounded">
                    White Logo
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gallery Tabs */}
      <div className="flex border-b border-zinc-800 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('posters')}
          className={`px-4 py-2 font-medium border-b-2 cursor-pointer transition ${
            activeTab === 'posters'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Posters ({images.posters.length}) {selectedPoster && '✓'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backdrops')}
          className={`px-4 py-2 font-medium border-b-2 cursor-pointer transition ${
            activeTab === 'backdrops'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Backgrounds / Backdrops ({images.backdrops.length}) {selectedBackdrop && '✓'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logos')}
          className={`px-4 py-2 font-medium border-b-2 cursor-pointer transition ${
            activeTab === 'logos'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Clearart / Logos ({images.logos.length}) {selectedLogo && '✓'} {selectedLogoWhite && '(White ✓)'}
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="min-h-[380px]">
        {loading ? (
          <div className="text-center py-20 text-xs text-zinc-500">
            Loading images from TMDB...
          </div>
        ) : activeTab === 'posters' ? (
          images.posters.length === 0 ? (
            <div className="text-center py-20 text-xs text-zinc-500">
              No posters loaded. Enter TMDB ID above and click "Fetch Images".
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto p-1">
              {images.posters.map((img) => {
                const isSelected = selectedPoster === img.file_path;
                return (
                  <button
                    key={img.file_path}
                    type="button"
                    onClick={() => setSelectedPoster(isSelected ? null : img.file_path)}
                    className={`group relative aspect-[2/3] rounded-lg overflow-hidden border-2 text-left transition cursor-pointer bg-zinc-950 ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <img src={`${TMDB_IMG_THUMB}${img.file_path}`} alt="Poster" className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 right-1.5">
                      {isSelected ? (
                        <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow">
                          ✓
                        </span>
                      ) : (
                        <span className="bg-zinc-900/80 text-zinc-400 opacity-0 group-hover:opacity-100 rounded text-[9px] px-1 py-0.5">
                          Select
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 py-1.5 text-[11px] text-zinc-300 flex items-center justify-between">
                      <span className="font-mono">{img.width}×{img.height}</span>
                      <LangBadge lang={img.iso_639_1} />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : activeTab === 'backdrops' ? (
          images.backdrops.length === 0 ? (
            <div className="text-center py-20 text-xs text-zinc-500">
              No backgrounds loaded.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
              {images.backdrops.map((img) => {
                const isSelected = selectedBackdrop === img.file_path;
                return (
                  <button
                    key={img.file_path}
                    type="button"
                    onClick={() => setSelectedBackdrop(isSelected ? null : img.file_path)}
                    className={`group relative aspect-video rounded-lg overflow-hidden border-2 text-left transition cursor-pointer bg-zinc-950 ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <img src={`${TMDB_IMG_THUMB}${img.file_path}`} alt="Backdrop" className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 right-1.5">
                      {isSelected ? (
                        <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow">
                          ✓
                        </span>
                      ) : (
                        <span className="bg-zinc-900/80 text-zinc-400 opacity-0 group-hover:opacity-100 rounded text-[9px] px-1 py-0.5">
                          Select
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 py-1.5 text-[11px] text-zinc-300 flex items-center justify-between">
                      <span className="font-mono">{img.width}×{img.height}</span>
                      <LangBadge lang={img.iso_639_1} />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          images.logos.length === 0 ? (
            <div className="text-center py-20 text-xs text-zinc-500">
              No clearart/logos loaded.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Logo Selection Mode Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-[11px] font-medium">Selecting:</span>
                  <button
                    type="button"
                    onClick={() => setLogoTarget('primary')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      logoTarget === 'primary'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <span>1. Primary Logo</span>
                    {selectedLogo && <span className="text-emerald-300 font-bold">✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogoTarget('white')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      logoTarget === 'white'
                        ? 'bg-zinc-100 text-zinc-950 shadow'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <span>2. White Logo (clearlogoWhite)</span>
                    <span className="text-[10px] opacity-70">(Optional)</span>
                    {selectedLogoWhite && <span className="text-emerald-500 font-bold">✓</span>}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  {selectedLogo && (
                    <button
                      type="button"
                      onClick={() => setSelectedLogo(null)}
                      className="text-zinc-400 hover:text-red-400 transition cursor-pointer"
                    >
                      Clear Primary
                    </button>
                  )}
                  {selectedLogo && selectedLogoWhite && <span className="text-zinc-700">•</span>}
                  {selectedLogoWhite && (
                    <button
                      type="button"
                      onClick={() => setSelectedLogoWhite(null)}
                      className="text-zinc-400 hover:text-red-400 transition cursor-pointer"
                    >
                      Clear White
                    </button>
                  )}
                </div>
              </div>

              {/* Logos Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto p-1">
                {images.logos.map((img) => {
                  const isPrimary = selectedLogo === img.file_path;
                  const isWhite = selectedLogoWhite === img.file_path;
                  const isSelected = isPrimary || isWhite;

                  return (
                    <button
                      key={img.file_path}
                      type="button"
                      onClick={() => {
                        if (logoTarget === 'primary') {
                          setSelectedLogo(isPrimary ? null : img.file_path);
                        } else {
                          setSelectedLogoWhite(isWhite ? null : img.file_path);
                        }
                      }}
                      className={`group relative aspect-video rounded-lg p-2 flex items-center justify-center border-2 transition cursor-pointer bg-zinc-950/90 ${
                        isPrimary && isWhite
                          ? 'border-indigo-400 ring-2 ring-indigo-400/50'
                          : isPrimary
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                          : isWhite
                          ? 'border-zinc-200 ring-2 ring-white/40'
                          : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <img src={`${TMDB_IMG_THUMB}${img.file_path}`} alt="Logo" className="max-h-full max-w-full object-contain" />

                      {/* Top-Right Badges */}
                      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end">
                        {isPrimary && (
                          <span className="bg-indigo-600 text-white rounded text-[10px] font-bold px-1.5 py-0.5 shadow">
                            Primary ✓
                          </span>
                        )}
                        {isWhite && (
                          <span className="bg-zinc-100 text-zinc-950 rounded text-[10px] font-bold px-1.5 py-0.5 shadow">
                            White ✓
                          </span>
                        )}
                        {!isSelected && (
                          <span className="bg-zinc-900/80 text-zinc-400 opacity-0 group-hover:opacity-100 rounded text-[9px] px-1 py-0.5">
                            Set {logoTarget === 'primary' ? 'Primary' : 'White'}
                          </span>
                        )}
                      </div>

                      {/* Hover direct action buttons in top-left */}
                      <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                        <span
                          role="button"
                          tabIndex={0}
                          title="Toggle Primary Logo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogo(isPrimary ? null : img.file_path);
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                            isPrimary ? 'bg-indigo-600 text-white' : 'bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800 border border-zinc-700'
                          }`}
                        >
                          Pri
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Toggle White Logo (clearlogoWhite)"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogoWhite(isWhite ? null : img.file_path);
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                            isWhite ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800 border border-zinc-700'
                          }`}
                        >
                          White
                        </span>
                      </div>

                      {/* Bottom Info Bar */}
                      <div className="absolute bottom-1.5 inset-x-0 px-2.5 flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="font-mono">{img.width}×{img.height}</span>
                        <LangBadge lang={img.iso_639_1} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
