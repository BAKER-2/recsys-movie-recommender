"use client";

import { useEffect, useMemo, useState } from "react";

type Movie = {
  movieId: number;
  title?: string | null;
  poster_url?: string | null;
};

export default function HomePage() {
  const [hasPersonalized, setHasPersonalized] = useState(false);
  const [popular, setPopular] = useState<Movie[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("personalized_recs_v1");
    setHasPersonalized(Boolean(raw && raw.length > 5));
  }, []);

  useEffect(() => {
    fetch("/api/recommend")
      .then((r) => r.json())
      .then((d) => {
        const recs = (d.recs || []) as Movie[];
        setPopular(recs);
      })
      .catch(() => setPopular([]));
  }, []);

  const posters = useMemo(() => {
    // keep only valid TMDB poster URLs
    return popular
      .filter((m) => typeof m.poster_url === "string" && m.poster_url.includes("image.tmdb.org"))
      .slice(0, 60); // limit for fast loads
  }, [popular]);

  // Preload posters once so carousel doesn't show blanks
  useEffect(() => {
    if (posters.length === 0) return;

    let done = 0;
    let cancelled = false;

    setReady(false);

    posters.forEach((m) => {
      const img = new Image();
      img.onload = () => {
        done += 1;
        if (!cancelled && done >= Math.min(20, posters.length)) setReady(true);
      };
      img.onerror = () => {
        done += 1;
        if (!cancelled && done >= Math.min(20, posters.length)) setReady(true);
      };
      img.src = m.poster_url!;
    });

    // if network is slow, don't block forever
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [posters]);

  // Seamless loop
  const marqueeItems = useMemo(() => [...posters, ...posters], [posters]);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col min-h-screen">
        {/* Top section */}
        <div className="pt-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Personalized Movie Recommender
          </h1>

          <p className="mt-6 text-lg text-zinc-300 max-w-2xl">
            Rate a few movies to generate recommendations using collaborative
            filtering (ALS matrix factorization trained on MovieLens 20M),
            enriched with TMDB metadata.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/rate"
              className="rounded-md bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-zinc-200"
            >
              Start rating
            </a>

            {hasPersonalized && (
              <a
                href="/results"
                className="rounded-md border border-zinc-700 px-5 py-3 text-sm hover:bg-zinc-900"
              >
                View personalized
              </a>
            )}

            {hasPersonalized && (
              <button
                onClick={() => {
                  localStorage.removeItem("personalized_recs_v1");
                  window.location.reload();
                }}
                className="rounded-md border border-zinc-700 px-5 py-3 text-sm hover:bg-zinc-900"
              >
                Clear personalization
              </button>
            )}
          </div>
        </div>

        {/* Bottom: carousel */}
        <div className="mt-12 flex-1 flex items-end">
          <div className="w-full">
            <div className="text-sm text-zinc-300 mb-3">Popular picks</div>

            {!ready ? (
              <div className="text-zinc-400">Loading posters…</div>
            ) : (
              <div className="relative w-full overflow-hidden">
                <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black via-transparent to-black" />

                <div className="marquee-track gap-4 py-6">
                  {marqueeItems.map((m, idx) => (
                    <PosterCard key={`${m.movieId}-${idx}`} m={m} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 text-xs text-zinc-400">
              (Auto-scrolling carousel of popular movies)
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PosterCard({ m }: { m: Movie }) {
  const [ok, setOk] = useState(true);

  return (
    <div className="shrink-0 w-[120px] sm:w-[140px] md:w-[170px]">
      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/60">
        <div className="aspect-[2/3] w-full bg-zinc-800">
          {ok && m.poster_url ? (
            <img
              src={m.poster_url}
              alt={m.title ?? "Movie"}
              className="w-full h-full object-cover"
              loading="eager"
              onError={() => setOk(false)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
              No poster
            </div>
          )}
        </div>
      </div>
    </div>
  );
}