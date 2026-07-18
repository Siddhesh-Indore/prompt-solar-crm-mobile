// src/lib/fetchAllRows.ts
// Supabase's PostgREST caps any response at 1,000 rows by default — an
// unbounded .select() past that point silently truncates rather than
// erroring, ordered however the query says. On leads (ordered newest-first)
// that meant once total rows crossed 1,000, everything older than the
// newest 1,000 disappeared from the queue/visits screens, and kept getting
// worse with every further import — not a crash, just quietly wrong data.
//
// Fetches every row regardless of table size by paging with .range() until
// a partial page comes back. `buildQuery` must build the query FRESH each
// call (base table + filters + order, no .range() yet) — a supabase-js
// query builder can't be re-awaited once it's been sent.
interface RangeResult<T> {
  data: T[] | null
  error: { message: string } | null
}

const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  buildQuery: () => { range(from: number, to: number): PromiseLike<RangeResult<T>> },
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}
