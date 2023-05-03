## M1 Quirks

If you're using an M1, there's a few things you need to do to make your life not suck during local development.

### Rebuild Qraph Node For arm64

The default container for the graph is built using x86. Chances are, when you try to run `yarn dev:site`, you'll see it crash due to an OOM when docker is running the x86 image through QEMU.

To fix this, run `scripts/rebuild_graph_m1.sh`, which rebuilds the graph targeting arm64 instead of x86.

### Enable Docker Experimental Features

Docker only has experimental support for the specific platform `arm64/v8` out of the box, so when running on an M1 you need to go to enable experimental features.

To do so, go to docker desktop, open settings, go to the "Docker Engine" tab, and ensure that the JSON config includes the line `"experimental": true`:

![A screenshot of a docker desktop config with experimental features enabled](/doc-images/docker-m1-config.png)


