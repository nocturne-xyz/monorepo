import { BigInteger } from "big-integer";
import bigInt = require("big-integer");

export function leBuffToInt(buff: Buffer): BigInteger {
  let res = bigInt.zero;
  for (let i = 0; i < buff.length; i++) {
    const n = bigInt(buff[i]);
    res = res.add(n.shiftLeft(i * 8));
  }
  return res;
}

export function bufferToBigIntBE(buff: Buffer): BigInteger {
  let number = bigInt(0);
  let pos = buff.length - 1;
  while (pos >= 0) {
    let tmpNum = bigInt(buff[pos]);
    tmpNum = tmpNum.shiftLeft(8 * (buff.length - 1 - pos));

    number = number.add(tmpNum);
    pos -= 1;
  }
  return number;
}

export function bigIntToBufferBE(number: BigInteger): Buffer {
  const buff = Buffer.alloc(32);
  let pos = buff.length - 1;
  while (!number.isZero()) {
    buff[pos] = Number(number.and(bigInt(255)));
    number = number.shiftRight(8);
    pos -= 1;
  }
  return buff;
}

export function isHex(input: string): boolean {
  const re = /[0-9A-Fa-f]{6}/g;
  if (input.substr(0, 2) === "0x") {
    input = input.substr(2);
  }
  return re.test(input);
}

export function bytesToHex(buff: Buffer): string {
  return `0x${buff.toString("hex")}`;
}

export function hexToBytes(hex: string): Buffer {
  if (!isHex(hex)) {
    throw new Error("Input string is not hex");
  }
  if (hex.substr(0, 2) === "0x") {
    return Buffer.from(hex.substr(2), "hex");
  }

  return Buffer.from(hex, "hex");
}
