# Executa

> Document executors: protocols, transports and reference implementations

[![Build status](https://travis-ci.org/stencila/executa.svg?branch=master)](https://travis-ci.org/stencila/executa)
[![Code coverage](https://codecov.io/gh/stencila/executa/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/executa)
[![NPM](https://img.shields.io/npm/v/@stencila/executa.svg?style=flat)](https://www.npmjs.com/package/@stencila/executa)

## Install

```bash
npm install --global @stencila/executa
```

## Usage

<!-- prettier-ignore-start -->
<!-- CONFIGA-USAGE-BEGIN -->
All configuration options can be set, in descending order of priority, by:

- a command line argument e.g. `--<value> <value>`
- an environment variable prefixed with `EXECUTA_` e.g. `EXECUTA_<option>=<value>`
- a `.json` or `.ini` configuration file, set using the `--config` option, or `.executarc` by default
<!-- CONFIGA-USAGE-END -->

<!-- CONFIGA-TABLE-BEGIN -->
| Name          | Description                                                                                         | Type               | Validators                                                 | Default         |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------- | --------------- |
| debug         | Display debug log data?                                                                             | `boolean`          |                                                            | `false`         |
| stdio         | Start a `stdio` server.                                                                             | `boolean`          |                                                            | `false`         |
| vsock         | Start a `vsock` server.<a href="#vsock-details"><sup>1</sup></a>                                    | `boolean | number` |                                                            | `false`         |
| tcp           | Start a TCP server.<a href="#tcp-details"><sup>2</sup></a>                                          | `boolean | string` | pattern: `/^((tcp?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/`   | `false`         |
| http          | Start a HTTP server.<a href="#http-details"><sup>3</sup></a>                                        | `boolean | string` | pattern: `/^((https?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/` | `false`         |
| ws            | Start a WebSocket server.<a href="#ws-details"><sup>4</sup></a>                                     | `boolean | string` | pattern: `/^((wss?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/`   | `false`         |
| peers         | List of peer addresses.<a href="#peers-details"><sup>5</sup></a>                                    | `string[]`         |                                                            | `["stdio://*"]` |
| queueLength   | Maximum length of the request queue.<a href="#queueLength-details"><sup>6</sup></a>                 | `number`           | minimum: `0`                                               | `1000`          |
| queueInterval | Interval between attempts to reduce request queue.<a href="#queueInterval-details"><sup>7</sup></a> | `number`           | exclusiveMinimum: `0`                                      | `1`             |
| queueStale    | Duration after which a request is removed from queue.<a href="#queueStale-details"><sup>8</sup></a> | `number`           | exclusiveMinimum: `0`                                      | `3600`          |


1. <a id="vsock-details"></a>If a `number`, it will be used as the port number.
If `true`, the default Vsock port `6000` will be used.
2. <a id="tcp-details"></a>If a `string`, it will be parsed and used as the address
of the TCP server.
If `true`, the default TCP address `tcp://127.0.0.1:7000`
will be used.
3. <a id="http-details"></a>If a `string`, it will be parsed and used as the address
of the HTTP server.
If `true`, the default HTTP address `http://127.0.0.1:8000`
will be used.
4. <a id="ws-details"></a>If a `string`, it will be parsed and used as the address
of the WebSocket server.
If `true`, the default WebSocket address `ws://127.0.0.1:9000`
will be used.
5. <a id="peers-details"></a>Each string in this list is parsed as an address to
a peer executor. e.g. `https://123.45.67.89/`, `docker://image`
6. <a id="queueLength-details"></a>When queue reaches this length, subsequent requests will
fail with an error response to client.
7. <a id="queueInterval-details"></a>Seconds.
8. <a id="queueStale-details"></a>Seconds. Client will be notified when a request is removed.

<!-- CONFIGA-TABLE-END -->
<!-- prettier-ignore-end -->

## Develop

### Testing with the REPL

There is an interactive REPL that can be used with the both `query` and `execute` CLI commands e.g.

```bash
npm run cli -- execute --repl --debug
```

### Testing in the browser

1. Build the browser Javascript

```bash
npm run build:browser
```

2. Serve Executa on ws://localhost:9000 (with reloading when source changes):

```bash
npm run cli:dev -- serve --ws
```

3. Visit http://localhost:9000 in your browser.

### Debug inspecting

There is a NPM script, `cli:debug`, that can be useful for debugging the CLI, for example from within VSCode (which will auto attach to the Node process), e.g.

```bash
npm run cli:debug -- compile test.md
```

### Integration testing with Docker

The [`Dockerfile`][Dockerfile] installs all know executor packages (e.g. `basha`, `pyla`) into a container so that they can be easily be tested for API compatibility (with one another, and clients). Get it from Docker Hub,

```bash
docker pull stencila/executa
```

You can build it locally if you prefer:

```bash
npm run docker:build
```

Or, to _force_ the latest version of all executor packages to be installed:

```bash
npm run docker:build:latest
```

Then run it using:

```bash
npm run docker:run
```

That will serve Executa from within the container and make it available at http://localhost:9000 and ws://localhost:9000.

## FAQ

#### Why is `@types/ws` a production dependency?

This package has several dependents e.g `@stencila/basha`. If `@types/ws` is not installed as a production dependency, when you try to build dependent packages, you get the error "Cannot find type definition file for 'ws'.". By having it as a production dependency here, each dependent package does not have to install it
as a development dependency.
