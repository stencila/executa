import {
  pattern,
  minimum,
  exclusiveMinimum
} from '@stencila/configa/dist/define'

/**
 * Executa ${version}
 */
export class Config {
  /**
   * Display debug log data?
   */
  debug = false

  /**
   * Start a `stdio` server.
   */
  stdio = false

  /**
   * Start a `vsock` server.
   *
   * If a `number`, it will be used as the port number.
   * If `true`, the default Vsock port `6000` will be used.
   */
  vsock: boolean | number = false

  /**
   * Start a TCP server.
   *
   * If a `string`, it will be parsed and used as the address
   * of the TCP server.
   * If `true`, the default TCP address `tcp://127.0.0.1:7000`
   * will be used.
   */
  @pattern(/^((tcp?:\/\/)?([^:/]+)(:(\d+))?(\/(.+))?)|(\d+)$/)
  tcp: boolean | string = false

  /**
   * Start a HTTP server.
   *
   * If a `string`, it will be parsed and used as the address
   * of the HTTP server.
   * If `true`, the default HTTP address `http://127.0.0.1:8000`
   * will be used.
   */
  @pattern(/^((https?:\/\/)?([^:/]+)(:(\d+))?(\/(.+))?)|(\d+)$/)
  http: boolean | string = false

  /**
   * Start a WebSocket server.
   *
   * If a `string`, it will be parsed and used as the address
   * of the WebSocket server.
   * If `true`, the default WebSocket address `ws://127.0.0.1:9000`
   * will be used.
   */
  @pattern(/^((wss?:\/\/)?([^:/]+)(:(\d+))?(\/(.+))?)|(\d+)$/)
  ws: boolean | string = false

  /**
   * Maximum length of the request queue.
   *
   * When queue reaches this length, subsequent requests will
   * fail with an error response to client.
   */
  @minimum(0)
  queueLength = 1000

  /**
   * Interval between attempts to reduce request queue.
   *
   * Seconds.
   */
  @exclusiveMinimum(0)
  queueInterval = 1

  /**
   * Duration after which a request is removed from queue.
   *
   * Seconds. Client will be notified when a request is removed.
   */
  @exclusiveMinimum(0)
  queueStale = 3600
}
