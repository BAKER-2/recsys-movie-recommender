"use client";

import { useEffect, useState } from "react";

type Rec = {
  movieId: number;
  title: string;
  poster_url: string | null;
  year: number | null;
  director: string | null;
};

export default function HomePage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const raw = localStorage.getItem("personalized_recs_v1");

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRecs(parsed);
        setLoading(false);
        return;
      }
    } catch {}
  }

  fetch("/api/recommend")
    .then((res) => res.json())
    .then((data) => {
      setRecs(data.recs);
      setLoading(false);
    });
}, []);


  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading recommendations…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <h1 className="text-3xl font-bold mb-6">
        Your Personalized Movie Recommendations
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {recs.map((m) => (
          <div
            key={m.movieId}
            className="bg-zinc-900 rounded-lg overflow-hidden"
          >
            {m.poster_url ? (
              <img
                src={m.poster_url}
                alt={m.title}
                className="w-full h-auto"
              />
            ) : (
              <div className="h-64 flex items-center justify-center bg-zinc-800">
                No image
              </div>
            )}

            <div className="p-2">
              <h2 className="text-sm font-semibold leading-tight">
                {m.title}
              </h2>
              {m.year && (
                <p className="text-xs text-zinc-400">{m.year}</p>
              )}
              {m.director && (
                <p className="text-xs text-zinc-500">
                  Dir. {m.director}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
