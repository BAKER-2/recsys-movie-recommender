import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TMDB_KEY = process.env.TMDB_API_KEY;

type TmdbPayload = {
  title: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  year: number | null;
  director: string | null;
  runtime: number | null;
  original_language: string | null;
  genres: string[] | null;
};

const TMDB_IMG = "https://image.tmdb.org/t/p";

// simple in-memory cache so repeated calls are fast
const tmdbCache = new Map<number, TmdbPayload>();

async function tmdbMovieFull(tmdbId: number): Promise<TmdbPayload | null> {
  if (!TMDB_KEY) return null;
  if (tmdbCache.has(tmdbId)) return tmdbCache.get(tmdbId)!;

  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`;
  const r = await fetch(url, { cache: "force-cache" });

  if (!r.ok) return null;

  const d: any = await r.json();

  let director: string | null = null;
  const crew = d?.credits?.crew || [];
  for (const c of crew) {
    if (c?.job === "Director") {
      director = c?.name ?? null;
      break;
    }
  }

  const payload: TmdbPayload = {
    title: d?.title ?? null,
    overview: d?.overview ?? null,
    year: d?.release_date ? Number(String(d.release_date).slice(0, 4)) : null,
    runtime: typeof d?.runtime === "number" ? d.runtime : null,
    original_language: d?.original_language ?? null,
    genres: Array.isArray(d?.genres) ? d.genres.map((g: any) => g?.name).filter(Boolean) : null,
    director,
    poster_url: d?.poster_path ? `${TMDB_IMG}/w342${d.poster_path}` : null,
    backdrop_url: d?.backdrop_path ? `${TMDB_IMG}/w780${d.backdrop_path}` : null,
  };

  tmdbCache.set(tmdbId, payload);
  return payload;
}

type RatingInput = { movieId: number; rating: number };

let LOADED = false;

let rows = 0;
let cols = 0;

let itemFactors: Float32Array; // rows*cols
let movieIds: number[]; // index -> movieId
let movieIdToIndex: Map<number, number>; // movieId -> index
let movieIdToTmdb: Record<string, number>;

function loadModelOnce() {
  if (LOADED) return;

  const dataDir = path.join(process.cwd(), "data");

  // shape
  const shape = JSON.parse(
    fs.readFileSync(path.join(dataDir, "item_factors_shape.json"), "utf-8")
  );
  rows = shape.rows;
  cols = shape.cols;

  // item factors buffer
  const buf = fs.readFileSync(path.join(dataDir, "item_factors.f32"));
  itemFactors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

  // ids mapping
  movieIds = JSON.parse(
    fs.readFileSync(path.join(dataDir, "movie_ids.json"), "utf-8")
  );
  movieIdToIndex = new Map<number, number>();
  for (let i = 0; i < movieIds.length; i++) movieIdToIndex.set(movieIds[i], i);

  // movieId -> tmdbId
  movieIdToTmdb = JSON.parse(
    fs.readFileSync(path.join(dataDir, "movieId_to_tmdb.json"), "utf-8")
  );

  LOADED = true;
}

function dotItemWithUser(itemIndex: number, userVec: Float32Array) {
  const base = itemIndex * cols;
  let s = 0;
  for (let j = 0; j < cols; j++) {
    s += itemFactors[base + j] * userVec[j];
  }
  return s;
}

function buildUserVector(ratings: RatingInput[]) {
  // Weighted average of item vectors using centered ratings: w = rating - 3
  const u = new Float32Array(cols);
  let denom = 0;

  for (const r of ratings) {
    const idx = movieIdToIndex.get(r.movieId);
    if (idx === undefined) continue;

    const w = r.rating - 3.0;
    if (w === 0) continue;

    denom += Math.abs(w);

    const base = idx * cols;
    for (let j = 0; j < cols; j++) {
      u[j] += w * itemFactors[base + j];
    }
  }

  if (denom > 0) {
    for (let j = 0; j < cols; j++) u[j] /= denom;
  }
  return u;
}

function topNFromScores(scores: Float32Array, N: number, exclude: Set<number>) {
  // Simple top-N (N=100) selection: keep a small sorted list
  const top: { movieId: number; score: number }[] = [];

  for (let i = 0; i < rows; i++) {
    const mid = movieIds[i];
    if (exclude.has(mid)) continue;

    const sc = scores[i];
    if (top.length < N) {
      top.push({ movieId: mid, score: sc });
      top.sort((a, b) => b.score - a.score);
    } else if (sc > top[top.length - 1].score) {
      top[top.length - 1] = { movieId: mid, score: sc };
      top.sort((a, b) => b.score - a.score);
    }
  }

  return top;
}

export async function GET() {
  // Backwards-compatible demo: return static recs file
  const p = path.join(process.cwd(), "data", "recs_top100.json");
  const raw = fs.readFileSync(p, "utf-8");
  const recs = JSON.parse(raw);
  return NextResponse.json({ ok: true, mode: "static", count: recs.length, recs });
}

export async function POST(req: Request) {
  loadModelOnce();

  const body = await req.json().catch(() => ({}));
  const ratings: RatingInput[] = Array.isArray(body?.ratings) ? body.ratings : [];

  // filter invalid ratings
  const clean = ratings
    .filter((r) => typeof r?.movieId === "number" && typeof r?.rating === "number")
    .map((r) => ({ movieId: Math.trunc(r.movieId), rating: Number(r.rating) }))
    .filter((r) => r.rating >= 1 && r.rating <= 5);

  const exclude = new Set<number>(clean.map((r) => r.movieId));

  // Build user vector
  const u = buildUserVector(clean);

  // Score all items
  const scores = new Float32Array(rows);
  for (let i = 0; i < rows; i++) scores[i] = dotItemWithUser(i, u);

  // Top-100 excluding rated
  const top = topNFromScores(scores, 100, exclude);

  // Return minimal UI fields (tmdbId + score); UI can render posters via TMDB image URLs later
 const recs = [];
for (const t of top) {
  const tmdbId = movieIdToTmdb[String(t.movieId)] ?? null;
  const payload = tmdbId ? await tmdbMovieFull(Number(tmdbId)) : null;

  recs.push({
    movieId: t.movieId,
    tmdbId,
    score: Number(t.score.toFixed(6)),
    title: payload?.title ?? `Movie #${t.movieId}`,
    poster_url: payload?.poster_url ?? null,
    backdrop_url: payload?.backdrop_url ?? null,
    overview: payload?.overview ?? null,
    year: payload?.year ?? null,
    director: payload?.director ?? null,
    runtime: payload?.runtime ?? null,
    original_language: payload?.original_language ?? null,
    genres: payload?.genres ?? null,
  });
}


  return NextResponse.json({
    ok: true,
    mode: "personalized",
    ratedCount: clean.length,
    recs,
  });
}
