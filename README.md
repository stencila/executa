# ⚡ Executa

#### Execution engine for executable documents

[![Build Status](https://dev.azure.com/stencila/stencila/_apis/build/status/stencila.executa?branchName=master)](https://dev.azure.com/stencila/stencila/_build/latest?definitionId=4&branchName=master)
[![Code coverage](https://codecov.io/gh/stencila/executa/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/executa)
[![NPM](https://img.shields.io/npm/v/@stencila/executa.svg?style=flat)](https://www.npmjs.com/package/@stencila/executa)

## Install

```bash
npm install --global @stencila/executa
```

## Use

<!-- prettier-ignore-start -->
<!-- CONFIGA-USAGE-BEGIN -->
All configuration options can be set, in descending order of priority, by:

- a command line argument e.g. `--<value> <value>`
- an environment variable prefixed with `EXECUTA_` e.g. `EXECUTA_<option>=<value>`
- a `.json` or `.ini` configuration file, set using the `--config` option, or `.executarc` by default
<!-- CONFIGA-USAGE-END -->

<!-- CONFIGA-TABLE-BEGIN -->
| Name          | Description                                                                                            | Type               | Validators                                                 | Default         |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------- | --------------- |
| debug         | Display debug log data?                                                                                | `boolean`          |                                                            | `false`         |
| stdio         | Start a `stdio` server.                                                                                | `boolean`          |                                                            | `false`         |
| vsock         | Start a `vsock` server.<a href="#vsock-details"><sup>1</sup></a>                                       | `boolean | number` |                                                            | `false`         |
| tcp           | Start a TCP server.<a href="#tcp-details"><sup>2</sup></a>                                             | `boolean | string` | pattern: `/^((tcp?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/`   | `false`         |
| http          | Start a HTTP server.<a href="#http-details"><sup>3</sup></a>                                           | `boolean | string` | pattern: `/^((https?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/` | `false`         |
| ws            | Start a WebSocket server.<a href="#ws-details"><sup>4</sup></a>                                        | `boolean | string` | pattern: `/^((wss?://)?([^:/]+)(:(d+))?(/(.+))?)|(d+)$/`   | `false`         |
| timeout       | Duration of inactivity after which the process should stop.<a href="#timeout-details"><sup>5</sup></a> | `number`           |                                                            | `0`             |
| timelimit     | Maximum duration for the process.<a href="#timelimit-details"><sup>6</sup></a>                         | `number`           |                                                            | `0`             |
| peers         | List of peer addresses.<a href="#peers-details"><sup>7</sup></a>                                       | `string[]`         |                                                            | `["stdio://*"]` |
| queueLength   | Maximum length of the request queue.<a href="#queueLength-details"><sup>8</sup></a>                    | `number`           | minimum: `0`                                               | `1000`          |
| queueInterval | Interval between attempts to reduce request queue.<a href="#queueInterval-details"><sup>9</sup></a>    | `number`           | exclusiveMinimum: `0`                                      | `1`             |
| queueStale    | Duration after which a request is removed from queue.<a href="#queueStale-details"><sup>10</sup></a>   | `number`           | exclusiveMinimum: `0`                                      | `3600`          |


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
5. <a id="timeout-details"></a>Seconds. Zero means no timeout.
6. <a id="timelimit-details"></a>Seconds. Zero means no time limit.
7. <a id="peers-details"></a>Each string in this list is parsed as an address to
a peer executor. e.g. `https://123.45.67.89/`, `docker://image`
8. <a id="queueLength-details"></a>When queue reaches this length, subsequent requests will
fail with an error response to client.
9. <a id="queueInterval-details"></a>Seconds.
10. <a id="queueStale-details"></a>Seconds. Client will be notified when a request is removed.

<!-- CONFIGA-TABLE-END -->
<!-- prettier-ignore-end -->

## Develop

### Testing with the REPL

There is an interactive REPL that can be used with the both `query` and `execute` CLI commands e.g.

```bash
npm run cli -- execute --repl --debug
```

### Testing in the browser

1. Serve Executa over HTTP (to provide static HTML) and WebSocket (to provide JSON RPC):

   ```bash
   npm run cli:dev -- serve --http --ws
   ```

> The `:dev` suffix to `cli` uses `ts-node-dev` which will restart the process when any source files change.

2. Visit http://localhost:8000 in your browser and play around with the `<stencila-code-chunk>` WebComponent that is connected to the Executa WebSocket that you just started.

![](.github/executa-in-browser.png)

### Debug inspecting

There is a NPM script, `cli:debug`, that can be useful for debugging the CLI, for example, from within VSCode (which will auto attach to the Node process), e.g.

```bash
npm run cli:debug -- serve --http
```

> The `:debug` suffix to `cli` enables the Node [debug inspector](https://nodejs.org/en/docs/guides/debugging-getting-started/) so you can use your favorite IDE to attach to the CLI and step through the code.

## FAQ

#### Why is `@types/ws` a production dependency?

This package has several dependents e.g `@stencila/basha`. If `@types/ws` is not installed as a production dependency,
when you try to build dependent packages, you get the error "Cannot find type definition file for 'ws'.". By having it
as a production dependency here, each dependent package does not have to install it as a development dependency.
