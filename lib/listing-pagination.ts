/**
 * Supabase queries return a limited range per request. Fetch successive
 * ranges so keyword/category filters can search every listing, not just
 * an arbitrary first page.
 */
export async function loadAllListings<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 200,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error('Page size must be a positive integer.');
  }

  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) return all;
    from += pageSize;
  }
}
