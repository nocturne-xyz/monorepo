export interface Job<T> {
  id: string;
  data: T;
}

export type DeserializeT<T> = (json: string | any) => T;

export function jobFromJson<T>(
  deserializeT: DeserializeT<T>,
  json: string | any
) {
  const obj = JSON.parse(json);
  return {
    id: obj.id,
    data: deserializeT(obj),
  };
}
