// To parse this data:
//
//   import { Convert, Welcome } from "./file";
//
//   const welcome = Convert.toWelcome(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export type Welcome = {
  type: string;
  contracts: Contracts;
  erc20s: Erc20S;
  protocolAllowlist: ProtocolAllowlist;
};

export type Contracts = {
  network: Network;
  startBlock: number;
  owners: Owners;
  proxyAdmin: string;
  depositManagerProxy: ErProxy;
  tellerProxy: ErProxy;
  handlerProxy: ErProxy;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
  screeners: string[];
  depositSources: string[];
};

export type ErProxy = {
  kind: string;
  proxy: string;
  implementation: string;
};

export type Network = {
  name: string;
  chainId: number;
};

export type Owners = {
  proxyAdminOwner: string;
  tellerOwner: string;
  handlerOwner: string;
  depositManagerOwner: string;
};

export type Erc20S = {
  "erc20-1": Erc201;
  "erc20-2": Erc201;
  weth: Erc201;
};

export type Erc201 = {
  address: string;
  globalCapWholeTokens: string;
  maxDepositSizeWholeTokens: string;
  precision: string;
  isGasAsset: boolean;
};

export type ProtocolAllowlist = {
  erc721: string;
  erc1155: string;
  "erc20-1": string;
  "erc20-2": string;
  weth: string;
};

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toWelcome(json: string): Welcome {
    return cast(JSON.parse(json), r("Welcome"));
  }

  public static welcomeToJson(value: Welcome): string {
    return JSON.stringify(uncast(value, r("Welcome")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(
    `Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(
      val
    )}`
  );
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a);
        })
        .join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== undefined) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(
  val: any,
  typ: any,
  getProps: any,
  key: any = "",
  parent: any = ""
): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key, parent);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(
      cases.map((a) => {
        return l(a);
      }),
      val,
      key,
      parent
    );
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val, key, parent);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue(l(ref || "object"), val, key, parent);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, key, ref);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref: any = undefined;
  while (typeof typ === "object" && typ.ref !== undefined) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty("props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val, key, parent);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
  return { literal: typ };
}

function a(typ: any) {
  return { arrayItems: typ };
}

// @ts-ignore
function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

// @ts-ignore
function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  Welcome: o(
    [
      { json: "type", js: "type", typ: "" },
      { json: "contracts", js: "contracts", typ: r("Contracts") },
      { json: "erc20s", js: "erc20s", typ: r("Erc20S") },
      {
        json: "protocolAllowlist",
        js: "protocolAllowlist",
        typ: r("ProtocolAllowlist"),
      },
    ],
    false
  ),
  Contracts: o(
    [
      { json: "network", js: "network", typ: r("Network") },
      { json: "startBlock", js: "startBlock", typ: 0 },
      { json: "owners", js: "owners", typ: r("Owners") },
      { json: "proxyAdmin", js: "proxyAdmin", typ: "" },
      {
        json: "depositManagerProxy",
        js: "depositManagerProxy",
        typ: r("ErProxy"),
      },
      { json: "tellerProxy", js: "tellerProxy", typ: r("ErProxy") },
      { json: "handlerProxy", js: "handlerProxy", typ: r("ErProxy") },
      {
        json: "joinSplitVerifierAddress",
        js: "joinSplitVerifierAddress",
        typ: "",
      },
      {
        json: "subtreeUpdateVerifierAddress",
        js: "subtreeUpdateVerifierAddress",
        typ: "",
      },
      { json: "screeners", js: "screeners", typ: a("") },
      { json: "depositSources", js: "depositSources", typ: a("") },
    ],
    false
  ),
  ErProxy: o(
    [
      { json: "kind", js: "kind", typ: "" },
      { json: "proxy", js: "proxy", typ: "" },
      { json: "implementation", js: "implementation", typ: "" },
    ],
    false
  ),
  Network: o(
    [
      { json: "name", js: "name", typ: "" },
      { json: "chainId", js: "chainId", typ: 0 },
    ],
    false
  ),
  Owners: o(
    [
      { json: "proxyAdminOwner", js: "proxyAdminOwner", typ: "" },
      { json: "tellerOwner", js: "tellerOwner", typ: "" },
      { json: "handlerOwner", js: "handlerOwner", typ: "" },
      { json: "depositManagerOwner", js: "depositManagerOwner", typ: "" },
    ],
    false
  ),
  Erc20S: o(
    [
      { json: "erc20-1", js: "erc20-1", typ: r("Erc201") },
      { json: "erc20-2", js: "erc20-2", typ: r("Erc201") },
      { json: "weth", js: "weth", typ: r("Erc201") },
    ],
    false
  ),
  Erc201: o(
    [
      { json: "address", js: "address", typ: "" },
      { json: "globalCapWholeTokens", js: "globalCapWholeTokens", typ: "" },
      {
        json: "maxDepositSizeWholeTokens",
        js: "maxDepositSizeWholeTokens",
        typ: "",
      },
      { json: "precision", js: "precision", typ: "" },
      { json: "isGasAsset", js: "isGasAsset", typ: true },
    ],
    false
  ),
  ProtocolAllowlist: o(
    [
      { json: "erc721", js: "erc721", typ: "" },
      { json: "erc1155", js: "erc1155", typ: "" },
      { json: "erc20-1", js: "erc20-1", typ: "" },
      { json: "erc20-2", js: "erc20-2", typ: "" },
      { json: "weth", js: "weth", typ: "" },
    ],
    false
  ),
};
