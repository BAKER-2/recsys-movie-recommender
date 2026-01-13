"use client";

import { useEffect, useMemo, useState } from "react";

type Rec = {
  movieId: number;
  title?: string | null;
  poster_url?: string | null;
  year?: number | null;
  director?: string | null;
  runtime?: number | null;
  original_language?: string | null;
  genres?: string[] | null;
  score?: number;
};

type RuntimeMode = "any" | "short" | "long";

function decadeOf(year?: number | null) {
  if (!year) return null;
  return Math.floor(year / 10) * 10;
}

export default function ResultsPage() {
  const [pool, setPool] = useState<Rec[]>([]);
  const [watched, setWatched] = useState<Set<number>>(new Set());

  // filters
  const [decade, setDecade] = useState<number | "any">("any");
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("any");
  const [language, setLanguage] = useState<string>("any");
  const [genre, setGenre] = useState<string>("any");

  // load pool + watched
  useEffect(() => {
    const rawPool =
      localStorage.getItem("personalized_recs_pool_v1") ||
      localStorage.getItem("personalized_recs_v1"); // fallback if you still have old key

    if (rawPool) {
      try {
        const parsed = JSON.parse(rawPool);
        if (Array.isArray(parsed)) setPool(parsed);
      } catch {}
    }

    const rawWatched = localStorage.getItem("watched_v1");
    if (rawWatched) {
      try {
        const arr: number[] = JSON.parse(rawWatched);
        setWatched(new Set(arr));
      } catch {}
    }
  }, []);

  // persist watched
  useEffect(() => {
    localStorage.setItem("watched_v1", JSON.stringify(Array.from(watched)));
  }, [watched]);

  const decades = useMemo(() => {
    const s = new Set<number>();
    pool.forEach((r) => {
      const d = decadeOf(r.year);
      if (d) s.add(d);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [pool]);

  const languages = useMemo(() => {
    const s = new Set<string>();
    pool.forEach((r) => {
      if (r.original_language) s.add(r.original_language);
    });
    return Array.from(s).sort();
  }, [pool]);

  const genres = useMemo(() => {
    const s = new Set<string>();
    pool.forEach((r) => (r.genres || []).forEach((g) => s.add(g)));
    return Array.from(s).sort();
  }, [pool]);

  function passesFilters(r: Rec) {
    if (watched.has(r.movieId)) return false;

    if (decade !== "any") {
      const d = decadeOf(r.year);
      if (d !== decade) return false;
    }

    if (runtimeMode === "short") {
      if (!(r.runtime != null && r.runtime < 100)) return false;
    }
    if (runtimeMode === "long") {
      if (!(r.runtime != null && r.runtime > 160)) return false;
    }

    if (language !== "any") {
      if (r.original_language !== language) return false;
    }

    if (genre !== "any") {
      const gs = r.genres || [];
      if (!gs.includes(genre)) return false;
    }

    return true;
  }

  // take from ranked pool until we fill 50
  const visible = useMemo(() => {
    const out: Rec[] = [];
    for (const r of pool) {
      if (passesFilters(r)) out.push(r);
      if (out.length >= 50) break;
    }
    return out;
  }, [pool, watched, decade, runtimeMode, language, genre]);

  function markWatched(mid: number) {
    setWatched((prev) => new Set(prev).add(mid));
  }

  function clearWatched() {
    setWatched(new Set());
    localStorage.removeItem("watched_v1");
  }

  function clearFilters() {
    setDecade("any");
    setRuntimeMode("any");
    setLanguage("any");
    setGenre("any");
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your personalized recommendations</h1>
            <p className="text-zinc-300 text-sm mt-2 max-w-2xl">
              Ranked by your taste using ALS matrix factorization. Rated + watched movies are excluded.
              Filters still keep 50 results by pulling further down the ranked list.
            </p>
          </div>

          <div className="flex gap-2">
            <a href="/" className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
              Home
            </a>
            <a href="/rate" className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-zinc-200">
              Rate more
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex flex-col">
              <label className="text-xs text-zinc-400 mb-1">Decade</label>
              <select
                value={decade}
                onChange={(e) => setDecade(e.target.value === "any" ? "any" : Number(e.target.value))}
                className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                {decades.map((d) => (
                  <option key={d} value={d}>{d}s</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-zinc-400 mb-1">Runtime</label>
              <select
                value={runtimeMode}
                onChange={(e) => setRuntimeMode(e.target.value as RuntimeMode)}
                className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="short">Short (&lt; 100 min)</option>
                <option value="long">Long (&gt; 160 min)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-zinc-400 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                {languages.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-zinc-400 mb-1">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 lg:ml-auto">
              <button
                onClick={clearFilters}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
              >
                Clear filters
              </button>
              <button
                onClick={clearWatched}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
              >
                Reset watched
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {visible.map((m, i) => (
            <div
              key={m.movieId}
              className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/60"
            >
              {/* Rank badge */}
              <div className="absolute top-2 left-2 z-10 rounded-full bg-black/70 border border-zinc-700 px-2 py-1 text-xs font-semibold">
                #{i + 1}
              </div>

              {m.poster_url ? (
                <img
                  src={m.poster_url}
                  alt={m.title ?? "Movie"}
                  className="w-full h-auto"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-zinc-800 flex items-center justify-center">
                  No image
                </div>
              )}

              <div className="p-2">
                <div className="text-sm font-semibold leading-tight">
                  {m.title ?? `Movie #${m.movieId}`}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {m.year ?? ""}{m.director ? ` • ${m.director}` : ""}
                </div>

                <button
                  onClick={() => markWatched(m.movieId)}
                  className="mt-2 w-full rounded-md border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-900"
                >
                  Watched ✓
                </button>
              </div>
            </div>
          ))}
        </div>

        {pool.length === 0 && (
          <div className="mt-10 text-zinc-300">
            No recommendations found yet. Go to <a className="underline" href="/rate">Rate</a> and generate.
          </div>
        )}
      </div>
    </main>
  );
}