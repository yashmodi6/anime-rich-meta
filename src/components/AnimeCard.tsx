import React from 'react';
import { AnimeRecord } from '../types';

const numFmt = new Intl.NumberFormat();

interface Props {
  anime: AnimeRecord;
}

export const AnimeCard: React.FC<Props> = ({ anime }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3.5 shadow-lg w-full max-w-[340px]">
      {/* Full-view Poster (no cropping / never cut) */}
      <div className="w-full aspect-[2/3] bg-zinc-950/80 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 shrink-0">
        {anime.posterUrl ? (
          <img
            src={anime.posterUrl}
            alt={anime.title.romaji || 'Anime poster'}
            className="w-full h-full object-contain"
            loading="eager"
          />
        ) : (
          <span className="text-xs text-zinc-500">No Poster</span>
        )}
      </div>

      {/* Badges row: Format, Status, Ep count, Airdate, Score, Pop */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {anime.format && (
          <span className="bg-blue-950/70 text-blue-300 border border-blue-800 text-[11px] px-2 py-0.5 rounded font-medium">
            {anime.format}
          </span>
        )}
        {anime.status && (
          <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-800 text-[11px] px-2 py-0.5 rounded font-medium">
            {anime.status}
          </span>
        )}
        {anime.episodes !== null && (
          <span className="bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-[11px] px-2 py-0.5 rounded">
            {anime.episodes} eps
          </span>
        )}
        {anime.airDate && (
          <span className="bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-[11px] px-2 py-0.5 rounded">
            {anime.airDate}
          </span>
        )}
        {anime.averageScore !== null && (
          <span className="bg-amber-950/70 text-amber-300 border border-amber-800 text-[11px] px-2 py-0.5 rounded font-medium">
            ★ {anime.averageScore}%
          </span>
        )}
        {anime.popularity !== null && (
          <span className="bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-[11px] px-2 py-0.5 rounded font-mono">
            Pop: {numFmt.format(anime.popularity)}
          </span>
        )}
      </div>

      {/* Key-Value Info List */}
      <div className="space-y-2 text-xs pt-1 border-t border-zinc-800/60">
        <div className="flex gap-2.5 items-baseline">
          <span className="text-zinc-500 w-16 shrink-0">ID</span>
          <span className="text-zinc-200 font-mono font-medium">{anime.id}</span>
        </div>

        <div className="flex gap-2.5 items-baseline">
          <span className="text-zinc-500 w-16 shrink-0">Romaji</span>
          <span className="text-zinc-200 leading-snug break-words flex-1 font-medium">
            {anime.title.romaji || '-'}
          </span>
        </div>

        <div className="flex gap-2.5 items-baseline">
          <span className="text-zinc-500 w-16 shrink-0">English</span>
          <span className="text-zinc-200 leading-snug break-words flex-1">
            {anime.title.english || '-'}
          </span>
        </div>

        <div className="flex gap-2.5 items-baseline">
          <span className="text-zinc-500 w-16 shrink-0">Native</span>
          <span className="text-zinc-200 font-sans leading-snug break-words flex-1">
            {anime.title.native || '-'}
          </span>
        </div>

        {/* Synonyms as pills */}
        {anime.synonyms && anime.synonyms.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/60">
            <span className="text-zinc-500 block mb-1.5">Synonyms</span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {anime.synonyms.map((syn, idx) => (
                <span
                  key={idx}
                  className="bg-zinc-800 text-zinc-300 text-[11px] px-1.5 py-0.5 rounded border border-zinc-700/60"
                >
                  {syn}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
