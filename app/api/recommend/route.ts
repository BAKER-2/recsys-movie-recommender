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

// ============================
// NEW SPECS
// ============================
// We will STORE a large pool to keep 50 results even after filters + watched removals.
const TOP_K_POOL = 2500;

// TMDB enrichment is expensive (rate-limits). Enrich only the top chunk.
// This is enough for smooth UI + filters most of the time.
const ENRICH_LIMIT = 600;

// limit concurrent TMDB fetches
const TMDB_CONCURRENCY = 12;

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
    genres: Array.isArray(d?.genres)
      ? d.genres.map((g: any) => g?.name).filter(Boolean)
      : null,
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
  itemFactors = new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / 4
  );

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

// ============================
// Efficient Top-K using a min-heap
// ============================
type TopItem = { movieId: number; score: number };

class MinHeap {
  private a: TopItem[] = [];
  size() {
    return this.a.length;
  }
  peek() {
    return this.a[0];
  }
  push(x: TopItem) {
    this.a.push(x);
    this.bubbleUp(this.a.length - 1);
  }
  pop(): TopItem | undefined {
    if (this.a.length === 0) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length > 0) {
      this.a[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }
  toArrayDesc() {
    // heap is min-heap; convert to array sorted descending
    return this.a.slice().sort((x, y) => y.score - x.score);
  }
  private bubbleUp(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].score <= this.a[i].score) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  private bubbleDown(i: number) {
    const n = this.a.length;
    while (true) {
      let m = i;
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      if (l < n && this.a[l].score < this.a[m].score) m = l;
      if (r < n && this.a[r].score < this.a[m].score) m = r;
      if (m === i) break;
      [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
      i = m;
    }
  }
}

function topKFromScores(scores: Float32Array, K: number, exclude: Set<number>) {
  const heap = new MinHeap();

  for (let i = 0; i < rows; i++) {
    const mid = movieIds[i];
    if (exclude.has(mid)) continue;

    const sc = scores[i];

    if (heap.size() < K) {
      heap.push({ movieId: mid, score: sc });
    } else if (sc > heap.peek().score) {
      heap.pop();
      heap.push({ movieId: mid, score: sc });
    }
  }

  return heap.toArrayDesc(); // sorted descending
}

// concurrency limiter for TMDB
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return out;
}

export async function GET() {
  // Homepage uses a static file, but return ONLY 50 for your new spec
  const p = path.join(process.cwd(), "data", "recs_top100.json");
  const raw = fs.readFileSync(p, "utf-8");
  const recs = JSON.parse(raw);
  return NextResponse.json({
    ok: true,
    mode: "static",
    count: Math.min(50, recs.length),
    recs: recs.slice(0, 50),
  });
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

  // Exclude the movies the user rated (so they never appear in recs)
  const exclude = new Set<number>(clean.map((r) => r.movieId));

  // Build user vector (this is using the trained model factors)
  const u = buildUserVector(clean);

  // Score all items
  const scores = new Float32Array(rows);
  for (let i = 0; i < rows; i++) scores[i] = dotItemWithUser(i, u);

  // Top-K pool (ranked by score)
  const topPool = topKFromScores(scores, TOP_K_POOL, exclude);

  // Enrich only the first ENRICH_LIMIT with TMDB metadata to avoid rate limits
  const enrichCount = Math.min(ENRICH_LIMIT, topPool.length);
  const head = topPool.slice(0, enrichCount);
  const tail = topPool.slice(enrichCount);

  const headEnriched = await mapWithLimit(head, TMDB_CONCURRENCY, async (t, idx) => {
    const tmdbId = movieIdToTmdb[String(t.movieId)] ?? null;
    const payload = tmdbId ? await tmdbMovieFull(Number(tmdbId)) : null;

    return {
      rank: idx + 1,
      movieId: t.movieId,
      tmdbId,
      score: Number(t.score.toFixed(6)),
      title: payload?.title ?? null,
      poster_url: payload?.poster_url ?? null,
      backdrop_url: payload?.backdrop_url ?? null,
      overview: payload?.overview ?? null,
      year: payload?.year ?? null,
      director: payload?.director ?? null,
      runtime: payload?.runtime ?? null,
      original_language: payload?.original_language ?? null,
      genres: payload?.genres ?? null,
    };
  });

  // Tail: return only minimal fields + rank; UI can lazily enrich later if needed
  const tailMinimal = tail.map((t, i) => {
    const tmdbId = movieIdToTmdb[String(t.movieId)] ?? null;
    return {
      rank: enrichCount + i + 1,
      movieId: t.movieId,
      tmdbId,
      score: Number(t.score.toFixed(6)),
      title: null,
      poster_url: null,
      backdrop_url: null,
      overview: null,
      year: null,
      director: null,
      runtime: null,
      original_language: null,
      genres: null,
    };
  });

  const recs = [...headEnriched, ...tailMinimal];

  return NextResponse.json({
    ok: true,
    mode: "personalized",
    ratedCount: clean.length,
    poolSize: recs.length,
    enrichedCount: headEnriched.length,
    recs,
  });
}