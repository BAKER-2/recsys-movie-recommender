"use client";

import { useEffect, useState } from "react";

type Rec = {
  movieId: number;
  title?: string | null;
  poster_url?: string | null;
  year?: number | null;
  director?: string | null;
  score?: number;
};

export default function HomePage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  const [hasPersonalized, setHasPersonalized] = useState(false);
  const [mode, setMode] = useState<"landing" | "personalized">("landing");

  useEffect(() => {
    const raw = localStorage.getItem("personalized_recs_v1");
    setHasPersonalized(Boolean(raw && raw.length > 5));
  }, []);

  // Load landing (popular) recs by default
  useEffect(() => {
    setLoading(true);
    fetch("/api/recommend")
      .then((res) => res.json())
      .then((data) => {
        setRecs(data.recs);
        setLoading(false);
      });
  }, []);

  async function showPersonalized() {
    const raw = localStorage.getItem("personalized_recs_v1");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMode("personalized");
        setRecs(parsed);
        setLoading(false);
      }
    } catch {}
  }

  function clearPersonalized() {
    localStorage.removeItem("personalized_recs_v1");
    setHasPersonalized(false);
    setMode("landing");

    // reload landing recs
    setLoading(true);
    fetch("/api/recommend")
      .then((res) => res.json())
      .then((data) => {
        setRecs(data.recs);
        setLoading(false);
      });
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Movie Recommender
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Rate a few movies to generate personalized recommendations using
            collaborative filtering (ALS matrix factorization on MovieLens 20M).
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/rate"
              className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-zinc-200"
            >
              Start rating (onboarding)
            </a>

            {hasPersonalized && mode !== "personalized" && (
              <button
                onClick={showPersonalized}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
              >
                View my personalized recommendations
              </button>
            )}

            {mode === "personalized" && (
              <button
                onClick={() => {
                  setMode("landing");
                  setLoading(true);
                  fetch("/api/recommend")
                    .then((res) => res.json())
                    .then((data) => {
                      setRecs(data.recs);
                      setLoading(false);
                    });
                }}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Back to popular picks
              </button>
            )}

            {hasPersonalized && (
              <button
                onClick={clearPersonalized}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Clear personalization
              </button>
            )}
          </div>

          <div className="mt-6 text-sm text-zinc-400">
            {mode === "personalized"
              ? "Showing: Personalized recommendations"
              : "Showing: Popular picks (default)"}
          </div>
        </div>

        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <p className="text-lg">Loading…</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {recs.map((m) => (
              <div
                key={m.movieId}
                className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition"
              >
                {m.poster_url ? (
                  <img
                    src={m.poster_url}
                    alt={m.title ?? "Movie"}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center bg-zinc-800">
                    No image
                  </div>
                )}

                <div className="p-2">
                  <h2 className="text-sm font-semibold leading-tight">
                    {m.title ?? `Movie #${m.movieId}`}
                  </h2>
                  {m.year && <p className="text-xs text-zinc-400">{m.year}</p>}
                  {m.director && (
                    <p className="text-xs text-zinc-500">Dir. {m.director}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}