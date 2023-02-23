export function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((x, i) => [x, b[i]]);
}

export function range(start: number, stop?: number, step = 1): number[] {
  if (!stop) {
    stop = start;
    start = 0;
  }

  return Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, i) => x + i * (step as number));
}

export function groupBy<T>(list: T[], keyGetter: (item: T) => string): T[][] {
  const map = new Map();
  for (const item of list) {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
      map.set(key, collection);
    }
  }

  return Array.from(map.values());
}

// splits an array into two arrays based on a predicate
// returns [pass, fail], where `pass` is the array of items that pass the predicate,
// and `fail` is the array of items that fail the predicate
export function partition<T>(
  arr: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const pass = [];
  const fail = [];
  for (const item of arr) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

export function* iterChunks<T>(
  arr: T[],
  chunkSize: number
): IterableIterator<T[]> {
  let chunk = [];
  const i = 0;
  while (i < arr.length) {
    chunk = arr.slice(i, i + chunkSize);
    yield chunk;
    arr = arr.slice(i + chunkSize);
  }
}

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
