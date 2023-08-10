import { ethers } from "ethers";

export function ensureChecksumAddresses(obj: any): any {
  const newObj: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
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

export function extractConfigName(configNameOrPath: string): string {
  // If configNameOrPath doesn't have a slash, but contains a period, it's a file name with extension
  if (
    !configNameOrPath.includes("/") &&
    !configNameOrPath.includes("\\") &&
    configNameOrPath.includes(".")
  ) {
    return configNameOrPath.split(".")[0];
  }

  // If configNameOrPath contains a slash, split by slashes and get the last part
  // to retrieve the file name with extension
  const parts = configNameOrPath.split(/[\/\\]/);
  const fileNameWithExtension = parts[parts.length - 1];

  // Split by dot and get the first part to retrieve the file name without extension
  return fileNameWithExtension.split(".")[0];
}
