"use client";

import { useEffect, useState } from "react";

type Movie = {
  movieId: number;
  title?: string | null;
  poster_url?: string | null;
};

export default function PosterMarquee() {
  const [items, setItems] = useState<Movie[]>([]);

  useEffect(() => {
    fetch("/api/recommend")
      .then((r) => r.json())
      .then((d) => {
        const recs = (d.recs || []) as Movie[];
        // duplicate for seamless loop
        setItems([...recs, ...recs, ...recs].filter((x) => x.poster_url));
      });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10" />

      <div className="marquee-track flex gap-4 py-6">
        {items.map((m, idx) => (
          <div
            key={`${m.movieId}-${idx}`}
            className="shrink-0 w-[120px] sm:w-[140px] md:w-[170px]"
          >
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
              {m.poster_url ? (
                <img
                  src={m.poster_url}
                  alt={m.title ?? "Movie"}
                  className="w-full h-auto"
                  loading="lazy"
                />
              ) : (
                <div className="h-56 bg-zinc-800" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}