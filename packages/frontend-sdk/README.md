# Frontend SDK

```bash
yarn add @nocturne-xyz/frontend-sdk
```

```ts
instantiate:
new NocturneSdk({
  networkName?: SupportedNetwork;
  provider?: SupportedProvider;
  snap?: GetSnapOptions;
} = {})

examples:
new NocturneSdk() // defaults to mainnet, ethers Web3Provider and latest version of Nocturne Snap

new NocturneSdk({
    networkName: "sepolia",
    provider: *custom provider*,
    snap: {
        version: "1.0.xx"
    }
})
```

## API

[API can be found here](https://github.com/nocturne-xyz/monorepo/blob/main/packages/frontend-sdk/src/api.ts)

## Considerations

- NocturneSdk must be run in the browser (as it uses window.ethereum)
- Currently, Nocturne SDK only supports Metamask, as Nocturne uses their Snap system
- Currently, Nocturne SDK uses [ethers.js](https://github.com/ethers-io/ethers.js)
- Additional reading on the Nocturne Protocol can be found over at the [GitBook](https://nocturne-xyz.gitbook.io/nocturne/the-nocturne-protocol/overview)

## Getting Started

Code examples will be drawn from Nocturne [interface codebase](https://github.com/nocturne-xyz/interface/tree/frontend-sdk-readme-freeze). The hosted instance is at https://veil.nocturnelabs.xyz/.

There are four main components to the lifecycle:

1. Connecting Metamask Snap
2. Syncing & Balances
3. Deposits
4. Transfers (Withdraw to EOA)

```ts
const sdk = new NocturneSdk();
```

### 1. Connecting Metamask Snap

[Snaps](https://docs.metamask.io/snaps/) are a system that allows dapps like Nocturne to extend app functionality into Metamask.

However, Snaps are still an experimental feature, and thus are featured in [Metamask Flask](https://metamask.io/flask/), a separate browser extension. Once Snaps has been merged into mainline Metamask (ETA 10/4/2023), separate installation will no longer be necessary, however until then, Flask is required for usage.

[Link to Chrome extension installation](https://chrome.google.com/webstore/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk).

```ts
// check for Flask extension
const isFlaskInstalled = await sdk.snap.isFlask();
if (!isFlaskInstalled) {
  // link to have user install Flask
}
```

[isFlask() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/metamask/store.ts#L31)

With Flask installed, connect to the Nocturne Snap.

```ts
await sdk.snap.connect();

const snapIsInstalled = Boolean(await sdk.snap.get());
```

[connect() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/hooks/useWalletAndNetwork.ts#L69)

[get() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/metamask/store.ts#L34)

From here, the Nocturne SDK will handle Snap management across various methods (for balances, deposits, transfers)

### 2. Syncing & Balances

Before a user is able to view their balances, the client must sync with the commitment tree, in order to view their notes ([what are notes?](https://nocturne-xyz.gitbook.io/nocturne/the-nocturne-protocol/preliminaries/notes-nullifiers-and-joinsplits)).

A cold start can take 10-20 minutes, however, for a returning user, syncing usually takes less than a minute. _We're actively working to lower time & improve this experience._

- _Users may deposit while syncing is in progress_

```ts
await sdk.syncWithProgress(<SyncOpts>);
```

[syncWithProgress() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/hooks/store/useSdkSync.ts#L15)

Once synced, the user can view their private balances.

```ts
await sdk.getAllBalances(<GetBalanceOpts>);
```

##### includeUncommitted

An important [optional] param is `includeUncommitted`, which if true will return the user's uncommitted balances.

- Uncommitted balances are balances that have been deposited, but not yet committed to the commitment tree. (It only takes a couple minutes for a deposit to be committed, but the distinction may be provided for posterity)
- Committed vs uncommitted balances are analagous to [available vs current balances](https://www.investopedia.com/terms/a/available-balance.asp#:~:text=In%20a%20checking%20account%2C%20the,to%20the%20available%20balance%20amount.) in a bank account.

[getAllBalances() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L36-L85)

### 3. Deposits

Deposits via Nocturne SDK are both rate-limited and monitored using onchain analytics tools, to help identify activity associated with terrorism
financing, human trafficking, and other financial
crimes.

- Deposits may be cancelled & retrieved at any time during this process.

```ts
// provides an ETA on how long the deposits will take to enter the protocol.
const quoteResponse = await sdk.getErc20DepositQuote(erc20Address, totalValue);
```

[getErc20DepositQuote() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/hooks/useDepositQuote.ts#L37)

```ts
const handles = await sdk.initiateEthDeposits(
        <list of deposits>,
        <specified gas compensation per deposit>
      );
```

[initiateEthDeposits() example](<https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/app/(DepositAndTransfer)/(Deposit)/DepositForm.tsx#L30>)

To get deposit request statuses, one can use the returned `DepositHandle` struct to retrieve up-to-date statuses per deposit, or use `getAllDeposits()` to retrieve all deposit handles.

[getAllDeposits() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L105)

Once the deposit has been accepted, the user's balances will be updated (uncommitted at first; committed shortly after).

If a deposit request has been rejected, or if the user would like to cancel a pending deposit, one can use `retrievePendingDeposit()` (Rejected deposit requests are technically pending, according to what is onchain).

```ts
    const tx = await sdk.retrievePendingDeposit(<deposit request object>);
```

[retrievePendingDeposit() example](<https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/app/(Slideover)/(Deposits)/DepositListItem.tsx#L140>)

### 4. Transfers (Withdraw to EOA)

Transfer from a Nocturne account to an EOA.

Transfers are an example of an `Operation` (another example are Confidential Payments (p2p Nocturne payments)—coming soon).

- It is recommended to fetch latest balances (`getAllBalances()`), which requires `sync()` before initiating a transfer, in order to see latest balances
- Only [committed balances](#includeUncommited) may be transferred

```ts
const handles = await sdk.anonTransferErc20(
        <erc20 address>,
        <total value to transfer>,
        <address to transfer to>
      );
```

[anonTransferErc20() example](<https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/app/(DepositAndTransfer)/(Transfer)/TransferForm.tsx#L40>)

To get operations that are in-flight, one can use the returned `OperationHandle` struct to retrieve up-to-date statuses per operation, or use `getInFlightOperations()` to retrieve all in-flight operation handles.

- _Currently, only transfers that are in flight are tracked. We plan to support full operation history in the future._

[getInFlightOperations() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L198)

Once the transfer has been completed, the recipient user will be able to view their new balance in their EOA.
