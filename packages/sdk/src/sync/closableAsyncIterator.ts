export class ClosableAsyncIterator<T> {
  readonly iter: AsyncIterableIterator<T>;
  readonly close: () => Promise<void>;

  constructor(iter: AsyncIterableIterator<T>, close: () => Promise<void>) {
    this.iter = iter;

    // ensure `this.close` only returns when the iterator is done
    this.close = async () => {
      await close();
      while (true) {
        const { done } = await this.iter.next();
        if (done) return;
      }
    };
  }

  // map all of `this`'s items to items of type `U` via mapper fn `f`
  map<U>(f: (item: T) => U): ClosableAsyncIterator<U> {
    const thisIter = this.iter;
    const mapped = async function* () {
      for await (const item of thisIter) {
        yield f(item);
      }
    };

    return new ClosableAsyncIterator(mapped(), async () => await this.close());
  }

  // iterate over the iterator in batches of size `batchSize`.
  // `exact` defaults to false
  // if `exact` is set to `false`, upon closing, any leftover elements will be emitted
  // that aren't enough to fill a batch will be emitted as a final batch of size < `batchSize`.
  // if `exact` is set to true, then any leftover elements will be discarded.
  batches(batchSize: number, exact = false): ClosableAsyncIterator<T[]> {
    const thisIter = this.iter;
    const batched = async function* () {
      let batch: T[] = [];
      for await (const item of thisIter) {
        batch.push(item);
        if (batch.length === batchSize) {
          yield batch;
          batch = [];
        }
      }
      if (!exact && batch.length > 0) yield batch;
    };

    return new ClosableAsyncIterator(batched(), async () => await this.close());
  }

  // execute a function over each item in the iterator without consuming the iterator or modifying the values
  // NOTE: the reference given to `f` will allow mutation of the underlying value in the iterator.
  tap(f: (item: T) => void): ClosableAsyncIterator<T> {
    const thisIter = this.iter;
    const tapped = async function* () {
      for await (const item of thisIter) {
        f(item);
        yield item;
      }
    };

    return new ClosableAsyncIterator(tapped(), async () => await this.close());
  }
}
