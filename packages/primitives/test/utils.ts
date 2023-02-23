import {
  generateRandomSpendingKey,
  spendPkFromFromSk,
  vkFromSpendPk,
} from "../src/crypto";

export function generateRandomViewingKey() {
  const sk = generateRandomSpendingKey();
  return vkFromSpendPk(spendPkFromFromSk(sk));
}
