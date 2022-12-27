# Bundler

## Overview

The bundler is responsible for receiving user operations and submitting them to the chain on behalf of the user. The bundler is split into 3 components: server, batcher, and submitter(s).

### Server

Runs an Express server and fields user requests. The server exposes two endpoints: `/relay` for receiving incoming operations to dispatch and `operations/{:id}` for querying the status of enqueued operations. For `/relay`, the server will validate the incoming operation and enqueue it for submission if valid. For `/operations/{:id}`, the server will get the operation's current status (e.g. ENQUEUED, IN_BATCH, EXECUTED_SUCCESS, etc) and return to the caller.

### Batcher

The batcher is responsible for taking elements from the queue of operations (that the server adds to) and putting them into batches for submitters. It attempts to fill batches of a specified size. If a specified latency time elapses before a batch reaches the designated size, the batcher will create a batch with whatever items are in the queue.

### Submitter

Takes batches off the operation batch queue and submits them to chain chain. One can handle greater traffic by running many submitters in parallel (that all draw from the same batch queue).

<br>

## How to Run the Bundler

You can run either the server, batcher or submitter. Note, you must include the environment variables shown in `.env.example` first. Assuming you have a populated `.env` file the `bundler-cli` is downloaded globally, you can simply run one of the following commands:

```
bundler-cli run server --wallet-address <address> --port <number>

bundler-cli run batcher

bundler-cli run submitter --wallet-address <address>
```
