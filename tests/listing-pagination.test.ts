import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAllListings } from '../lib/listing-pagination';

test('loads every listing through multiple Supabase ranges', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const ranges: Array<[number, number]> = [];
  const result = await loadAllListings(async (from, to) => {
    ranges.push([from, to]);
    return { data: ids.slice(from, to + 1), error: null };
  }, 2);
  assert.deepEqual(result, ids);
  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 5]]);
});

test('handles an empty marketplace without retry loops', async () => {
  let calls = 0;
  const result = await loadAllListings(async () => {
    calls += 1;
    return { data: [], error: null };
  });
  assert.deepEqual(result, []);
  assert.equal(calls, 1);
});

test('surfaces database errors instead of showing incomplete results', async () => {
  let calls = 0;
  await assert.rejects(
    () => loadAllListings(async (from) => {
      calls += 1;
      return from === 0
        ? { data: ['a', 'b'], error: null }
        : { data: null, error: new Error('Database unavailable') };
    }, 2),
    /Database unavailable/,
  );
  assert.equal(calls, 2);
});
