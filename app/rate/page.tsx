"use client";

import { useEffect, useMemo, useState } from "react";

type Movie = {
  movieId: number;
  title: string;
  poster_url: string | null;
  year: number | null;
  director: string | null;
  overview?: string | null;
};

type RatingsMap = Record<number, number>;

function Star({ filled }: { filled: boolean }) {
  return <span className={filled ? "text-yellow-400" : "text-zinc-600"}>★</span>;
}

export default function RatePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [ratings, setRatings] = useState<RatingsMap>({});
  const [loading, setLoading] = useState(true);

  // how many movies are currently shown
  const [visibleCount, setVisibleCount] = useState(20);

  // Load onboarding movies
  useEffect(() => {
    fetch("/onboarding_250_diverse.json")
      .then((r) => r.json())
      .then((data) => {
        setMovies(data);
        setLoading(false);
      });
  }, []);

  // Load ratings from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("ratings_v1");
    if (raw) setRatings(JSON.parse(raw));
  }, []);

  // Persist ratings
  useEffect(() => {
    localStorage.setItem("ratings_v1", JSON.stringify(ratings));
  }, [ratings]);

  const ratedCount = useMemo(() => Object.keys(ratings).length, [ratings]);

  function setRating(movieId: number, value: number) {
    setRatings((prev) => ({ ...prev, [movieId]: value }));
  }

  function clearRatings() {
    setRatings({});
  }

  const visibleMovies = useMemo(() => {
    return movies.slice(0, Math.min(visibleCount, movies.length));
  }, [movies, visibleCount]);

  const canLoadMore = visibleCount < movies.length;

  async function generate() {
    const payload = Object.entries(ratings).map(([movieId, rating]) => ({
      movieId: Number(movieId),
      rating: Number(rating),
    }));

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratings: payload }),
    });

    const data = await res.json();

    // Store a BIG pool (e.g., top 2500) so filters/watched can still keep 50 results
    localStorage.setItem(
      "personalized_recs_pool_v1",
      JSON.stringify(data.recs || [])
    );

    // Optional: clear watched when generating new recommendations
    localStorage.removeItem("watched_v1");

    window.location.href = "/results";
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        <p className="text-lg">Loading onboarding movies…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      {/* Top nav */}
      <div className="border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-6">
          <a href="/" className="hover:text-zinc-300">
            Home
          </a>
          <a href="/rate" className="font-semibold hover:text-zinc-300">
            Rate
          </a>
          <a href="/results" className="hover:text-zinc-300">
            Results
          </a>
        </div>
      </div>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-zinc-800 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rate movies</h1>
            <p className="text-sm text-zinc-300">
              Rate as many as you can — more ratings = better personalization.
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Showing {visibleMovies.length} / / {movies.length}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-200">
              Rated: <span className="font-semibold">{ratedCount}</span>
            </span>

            <button
              onClick={clearRatings}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
            >
              Clear
            </button>

            <a
              href="/"
              className="rounded-md bg-white text-black px-3 py-2 text-sm font-semibold hover:bg-zinc-200"
            >
              Back home
            </a>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {visibleMovies.map((m) => {
            const current = ratings[m.movieId] ?? 0;

            return (
              <div
                key={m.movieId}
                className="rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600 transition"
              >
                {m.poster_url ? (
                  <img
                    src={m.poster_url}
                    alt={m.title}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center bg-zinc-800">
                    No image
                  </div>
                )}

                <div className="p-3">
                  <div className="text-sm font-semibold leading-tight">
                    {m.title}
                  </div>

                  <div className="text-xs text-zinc-400 mt-1">
                    {m.year ? m.year : ""}
                    {m.director ? ` • ${m.director}` : ""}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1 text-lg">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => setRating(m.movieId, v)}
                          className="leading-none"
                          aria-label={`Rate ${v}`}
                        >
                          <Star filled={v <= current} />
                        </button>
                      ))}
                    </div>

                    {current > 0 && (
                      <button
                        onClick={() => {
                          const copy = { ...ratings };
                          delete copy[m.movieId];
                          setRatings(copy);
                        }}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Next step</div>
              <div className="text-sm text-zinc-400">
                Option 1: load 10 more movies to rate. Option 2: generate
                recommendations (rated movies will be excluded).
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() =>
                  setVisibleCount((v) => Math.min(v + 10, movies.length))
                }
                disabled={!canLoadMore}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  canLoadMore
                    ? "border border-zinc-700 hover:bg-zinc-900"
                    : "border border-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                Rate 10 more
              </button>

              <button
                onClick={generate}
                className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-zinc-200"
              >
                Generate recommendations
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}