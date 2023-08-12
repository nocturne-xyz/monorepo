import { EthToTokenConverter } from "./converter";

export class MockEthToTokenConverter extends EthToTokenConverter {
  constructor() {
    super();
  }

  weiToTargetErc20(amountWei: bigint, _targetTicker: string): Promise<bigint> {
    return Promise.resolve(amountWei);
  }
}
