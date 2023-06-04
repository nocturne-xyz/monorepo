import { ethers } from "ethers";

export function ensureChecksumAddresses(obj: any): any {
  const newObj: any = Array.isArray(obj) ? [] : {};

  for (let key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      newObj[key] = ensureChecksumAddresses(obj[key]);
    } else {
      if (typeof obj[key] === "string" && ethers.utils.isAddress(obj[key])) {
        try {
          newObj[key] = ethers.utils.getAddress(obj[key]);
        } catch (error) {
          console.log(`Error processing key "${key}": ${error}`);
          newObj[key] = obj[key];
        }
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  return newObj;
}
