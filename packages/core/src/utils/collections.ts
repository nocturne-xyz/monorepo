import * as JSON from "bigint-json-serialization";

export class MapWithObjectKeys<K, V> {
  private data: Record<string, V> = {};

  constructor(entries?: ReadonlyArray<[K, V]>) {
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  set(key: K, value: V): this {
    const keyString = JSON.stringify(key);
    this.data[keyString] = value;
    return this;
  }

  get(key: K): V | undefined {
    const keyString = JSON.stringify(key);
    return this.data[keyString];
  }

  has(key: K): boolean {
    const keyString = JSON.stringify(key);
    return keyString in this.data;
  }

  delete(key: K): boolean {
    const keyString = JSON.stringify(key);
    if (keyString in this.data) {
      delete this.data[keyString];
      return true;
    }
    return false;
  }

  clear(): void {
    this.data = {};
  }

  size(): number {
    return Object.keys(this.data).length;
  }

  entries(): IterableIterator<[K, V]> {
    const entries: [K, V][] = [];
    for (const keyString in this.data) {
      const key = JSON.parse(keyString);
      const value = this.data[keyString];
      entries.push([key, value]);
    }
    return entries[Symbol.iterator]();
  }

  keys(): IterableIterator<K> {
    const keys: K[] = [];
    for (const keyString in this.data) {
      const key = JSON.parse(keyString);
      keys.push(key);
    }
    return keys[Symbol.iterator]();
  }

  values(): IterableIterator<V> {
    const values: V[] = Object.values(this.data);
    return values[Symbol.iterator]();
  }

  forEach(
    callbackfn: (value: V, key: K, map: MapWithObjectKeys<K, V>) => void,
    thisArg?: any
  ): void {
    for (const [key, value] of this.entries()) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }
}

export class SetWithObjectKeys<T> {
  private data: Record<string, T> = {};

  constructor(iterable?: Iterable<T>) {
    if (iterable) {
      for (const value of iterable) {
        this.add(value);
      }
    }
  }

  add(value: T): this {
    const valueString = JSON.stringify(value);
    this.data[valueString] = value;
    return this;
  }

  has(value: T): boolean {
    const valueString = JSON.stringify(value);
    return valueString in this.data;
  }

  delete(value: T): boolean {
    const valueString = JSON.stringify(value);
    if (valueString in this.data) {
      delete this.data[valueString];
      return true;
    }
    return false;
  }

  clear(): void {
    this.data = {};
  }

  size(): number {
    return Object.keys(this.data).length;
  }

  values(): IterableIterator<T> {
    const values: T[] = Object.values(this.data);
    return values[Symbol.iterator]();
  }

  forEach(
    callbackfn: (value: T, set: SetWithObjectKeys<T>) => void,
    thisArg?: any
  ): void {
    for (const value of this.values()) {
      callbackfn.call(thisArg, value, this);
    }
  }
}
