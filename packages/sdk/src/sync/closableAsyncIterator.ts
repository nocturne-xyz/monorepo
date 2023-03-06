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
}
