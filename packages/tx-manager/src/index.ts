// forked from https://github.com/kendricktan/ynatm
import Bluebird from "bluebird";
import { ethers } from "ethers";

// GWEI = 1e9
const GWEI = Math.pow(10, 9);
const MAX_INT32 = ~(1 << 31);

const toGwei = (x: number): number => x * GWEI;

interface GasPriceScalingParams {
  x: number;
  y?: number;
  c?: number;
}

type GasPriceScalingFunction = (params: GasPriceScalingParams) => number;

const EXPONENTIAL =
  (base = 2, inGwei = true): GasPriceScalingFunction =>
  ({ x }: GasPriceScalingParams): number => {
    let p = Math.pow(base, x);
    if (inGwei) {
      p = toGwei(p);
    }
    return x + p;
  };

const LINEAR =
  (slope = 1, inGwei = true): GasPriceScalingFunction =>
  ({ x, c = 0 }: GasPriceScalingParams): number => {
    let p = slope * x;
    if (inGwei) {
      p = toGwei(p);
    }
    return x + p + c;
  };

const DOUBLES: GasPriceScalingFunction = ({
  y = 0,
}: GasPriceScalingParams): number => {
  return y * 2;
};

const sanitizeTimeout = (timeout: number): number => {
  if (timeout > MAX_INT32) {
    console.log(
      `WARNING: Timeout larger than max supported timeout size.
                    ${timeout} set to ${MAX_INT32}.
          `
    );
    return MAX_INT32;
  }
  return timeout;
};

const getGasPriceVariations = ({
  minGasPrice,
  maxGasPrice,
  gasPriceScalingFunction,
}: {
  minGasPrice: number;
  maxGasPrice: number;
  gasPriceScalingFunction: GasPriceScalingFunction;
}): number[] => {
  let i = 0;
  let curGasPrice = minGasPrice;
  let gasPrices: number[] = [];

  const firstGasPriceDelta =
    gasPriceScalingFunction({ x: minGasPrice, c: 1 }) - minGasPrice;
  if (firstGasPriceDelta / minGasPrice < 1e-6) {
    console.log(
      `WARNING: GasPrice is scaling very slowly. Might take a while.
                Double check the supplied gasPriceScalingFunction.
                If you're using a custom function, make sure to use toGwei.
      `
    );
  }

  for (;;) {
    if (curGasPrice > maxGasPrice) break;
    gasPrices = gasPrices.concat(curGasPrice);
    curGasPrice = gasPriceScalingFunction({
      y: curGasPrice,
      x: ++i,
      c: minGasPrice,
    });
  }

  return gasPrices;
};

const rejectOnRevert = (e: any): boolean => {
  return e.toString().toLowerCase().includes("revert");
};

type SendTransactionFunction = (
  gasPrice: number
) => Promise<ethers.ContractReceipt>;

type RejectCondition = (e: any) => boolean;

const send = async ({
  sendTransactionFunction,
  minGasPrice,
  maxGasPrice,
  gasPriceScalingFunction = LINEAR(5),
  delay = 60000,
  rejectImmediatelyOnCondition = rejectOnRevert,
}: {
  sendTransactionFunction: SendTransactionFunction;
  minGasPrice: number;
  maxGasPrice?: number;
  gasPriceScalingFunction?: GasPriceScalingFunction;
  delay?: number;
  rejectImmediatelyOnCondition?: RejectCondition;
}): Promise<ethers.ContractReceipt> => {
  minGasPrice = parseInt(minGasPrice.toString());

  if (!maxGasPrice) {
    maxGasPrice = 2 * minGasPrice;
  } else {
    maxGasPrice = parseInt(maxGasPrice.toString());
  }

  const gasPrices = getGasPriceVariations({
    minGasPrice,
    maxGasPrice,
    gasPriceScalingFunction,
  });

  return new Bluebird((resolve, reject) => {
    const timeoutIds: NodeJS.Timeout[] = [];
    const failedTxs: any[] = [];

    const finalTimeoutId = setTimeout(() => {
      reject(new Error("Transaction taking too long!"));
    }, sanitizeTimeout((gasPrices.length + 1) * delay));
    timeoutIds.push(finalTimeoutId);

    for (const [i, gasPrice] of gasPrices.entries()) {
      const waitForTx = async () => {
        try {
          const tx = await sendTransactionFunction(gasPrice);
          for (const tid of timeoutIds) {
            clearTimeout(tid);
          }
          resolve(tx);
        } catch (e) {
          failedTxs.push(e);
          if (
            failedTxs.length >= gasPrices.length ||
            rejectImmediatelyOnCondition(e)
          ) {
            for (const tid of timeoutIds) {
              clearTimeout(tid);
            }
            reject(e);
          }
        }
      };
      const timeoutId = setTimeout(waitForTx, sanitizeTimeout(i * delay));
      timeoutIds.push(timeoutId);
    }
  });
};

export { send, toGwei, EXPONENTIAL, LINEAR, DOUBLES };
