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

  filter(f: (item: T) => boolean): ClosableAsyncIterator<T> {
    const thisIter = this.iter;
    const filtered = async function* () {
      for await (const item of thisIter) {
        if (f(item)) yield item;
      }
    };

    return new ClosableAsyncIterator(
      filtered(),
      async () => await this.close()
    );
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

  tapAsync(f: (item: T) => Promise<void>): ClosableAsyncIterator<T> {
    const thisIter = this.iter;
    const tapped = async function* () {
      for await (const item of thisIter) {
        await f(item);
        yield item;
      }
    };

    return new ClosableAsyncIterator(tapped(), async () => await this.close());
  }

  // return an iterator that will emit all of the elements of `this`, then all of the elements of `other`
  // `other` will only begin to be consumed once `this` closes
  chain(other: ClosableAsyncIterator<T>): ClosableAsyncIterator<T> {
    const thisIter = this.iter;
    const chained = async function* () {
      for await (const item of thisIter) {
        yield item;
      }
      for await (const item of other.iter) {
        yield item;
      }
    };

    return new ClosableAsyncIterator(chained(), async () => {
      await this.close();
      await other.close();
    });
  }

  async collect(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this.iter) {
      items.push(item);
    }

    await this.close();
    return items;
  }

  static flatten<T>(
    self: ClosableAsyncIterator<T[]>
  ): ClosableAsyncIterator<T> {
    const thisIter = self.iter;
    const flattened = async function* () {
      for await (const batch of thisIter) {
        for (const item of batch) {
          yield item;
        }
      }
    };

    return new ClosableAsyncIterator(
      flattened(),
      async () => await self.close()
    );
  }

  static flatMap<T, U>(
    self: ClosableAsyncIterator<T[]>,
    f: (batch: T) => U
  ): ClosableAsyncIterator<U> {
    const thisIter = self.iter;
    const flattened = async function* () {
      for await (const batch of thisIter) {
        for (const item of batch) {
          yield f(item);
        }
      }
    };

    return new ClosableAsyncIterator(
      flattened(),
      async () => await self.close()
    );
  }
}
