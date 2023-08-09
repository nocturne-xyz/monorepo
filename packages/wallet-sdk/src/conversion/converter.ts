export abstract class EthToTokenConverter {
  abstract weiToTargetErc20(
    amountWei: bigint,
    targetTicker: string
  ): Promise<bigint>;

  async gasEstimatesInGasAssets(
    amountWei: bigint,
    tickers: string[]
  ): Promise<Map<string, bigint>> {
    const gasEstimates = new Map<string, bigint>();

    await Promise.all(
      tickers.map(async (ticker) => {
        const targetErc20 = await this.weiToTargetErc20(amountWei, ticker);
        gasEstimates.set(ticker, targetErc20);
      })
    );

    return gasEstimates;
  }
}
