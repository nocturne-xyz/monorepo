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

// examples:
new NocturneSdk() // defaults to mainnet (yet to be supported!), ethers Web3Provider and latest version of Nocturne Snap

new NocturneSdk({
    networkName: "sepolia",
    provider: <custom provider>, // check out `SupportedProvider` from `@nocturne-xyz/frontend-sdk`
    snap: {
        version: "1.0.xx"
    }
})
```

## API

[API can be found here](https://github.com/nocturne-xyz/monorepo/blob/main/packages/frontend-sdk/src/api.ts)

## Considerations

- NocturneSdk must be run in the browser (as it uses window.ethereum)
- Currently, Nocturne SDK only supports Metamask, as Nocturne relies on their Snap system
- Currently, Nocturne SDK uses [ethers.js](https://github.com/ethers-io/ethers.js)
- Additional reading on the Nocturne Protocol can be found over at the [GitBook](https://nocturne-xyz.gitbook.io/nocturne/the-nocturne-protocol/overview)

## Getting Started

Code examples will be drawn from Nocturne [interface codebase](https://github.com/nocturne-xyz/interface/tree/frontend-sdk-readme-freeze). The hosted instance is at https://veil.nocturnelabs.xyz/.

There are four main components to the lifecycle:

1. Connecting MetaMask Snap
2. Syncing & Balances
3. Deposits
4. Transfers (Withdraw to EOA)

```ts
const sdk = new NocturneSdk();
```

### 1. Connecting MetaMask Snap

[Snaps](https://docs.metamask.io/snaps/) are a system that allows developers to add application-specific functionality to MetaMask. Nocturne uses it for key management and private state management.

However, Snaps are still an experimental feature, so they are only supported in [MetaMask Flask](https://metamask.io/flask/), a separate extension for the development version of MetaMask. Once Snaps are merged into mainline MetaMask (expected 10/4/2023), a separate installation will no longer be necessary.

[Link to Chrome extension installation](https://chrome.google.com/webstore/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk).

You can case on `sdk.snap.isFlask()` to determine whether or not the user has Flask installed, and instruct accordingly:

```ts
// check for Flask extension
const isFlaskInstalled = await sdk.snap.isFlask();
if (!isFlaskInstalled) {
  // display a link instructing the user to go install Flask
}
```

[isFlask() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/metamask/store.ts#L31)

Once Flask is installed, connect to the snap like so:

```ts
await sdk.snap.connect();

const snapIsInstalled = Boolean(await sdk.snap.get());
```

[connect() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/hooks/useWalletAndNetwork.ts#L69)

[get() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/metamask/store.ts#L34)

Once the snap is connected, `NocturneSdk` handles the rest of interaction with MetaMask requests - the frontend only needs to interact with the snap directly for connection and disconnection.

### 2. Syncing & Balances

Before a user is able to view their balances, the client must sync with the commitment tree, in order to view their notes ([what are notes?](https://nocturne-xyz.gitbook.io/nocturne/the-nocturne-protocol/preliminaries/notes-nullifiers-and-joinsplits)).

A cold start can take 10-20 minutes, however, for a returning user, syncing usually takes less than a minute. _We're actively working to lower time & improve this experience._

> _Users may deposit while syncing is in progress_

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

- By "uncommitted balances", we mean balances including "uncommitted funds", which are funds that the user owns, but are not yet spendable, as they have yet to be inserted into the commitment tree (we update it in batches for gas optimization).
  - It only takes a couple minutes for a deposit to be committed, but we include this option so that frontends may choose how they wish to display this to the user.
- This is analogous to the familiar ["available vs current balance"](https://www.investopedia.com/terms/a/available-balance.asp#:~:text=In%20a%20checking%20account%2C%20the,to%20the%20available%20balance%20amount.) in your typical bank account UI.

[getAllBalances() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L36-L85)

### 3. Deposits

Deposits into Nocturne are rate-limited and monitored using on-chain analytics tools. This helps us identify activity associated with financial crimes like terrorism financing and human trafficking.

> Deposits may be cancelled & retrieved at any time during this process. The retrieval process is outlined shortly below.

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

To get status updates on in-flight deposits, call the `getStatus()` method on the `DepositHandle` struct returned by the method that initiated it. You can also use `getAllDeposits()` to fetch handles for all in-flight deposits.

[getAllDeposits() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L105)

Once the deposit has been accepted, the user's balances will be updated (uncommitted at first; committed shortly after).

Use `retrievePendingDeposit()` to cancel and return a pending deposit. This will be how users retrieve their funds from rejected deposits (rejected deposit requests are technically considered pending).

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
const handles = await sdk.initiateAnonErc20Transfer(
        <erc20 address>,
        <total value to transfer>,
        <address to transfer to>
      );
```

[initiateAnonErc20Transfer() example](<https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/app/(DepositAndTransfer)/(Transfer)/TransferForm.tsx#L40>)

To get status updates on in-flight operations, call the `getStatus` method on the `OperationHandle` struct returned by the method that initiated it. You can also use `getInFlightOperations()` to fetch handles for all in-flight operations.

> _Currently, only transfers that are in flight are tracked. We plan to support full operation history in the future._

[getInFlightOperations() example](https://github.com/nocturne-xyz/interface/blob/frontend-sdk-readme-freeze/src/config/zustand/store.ts#L198)

Once the transfer has been completed, the recipient user will be able to view their new balance in their EOA.
