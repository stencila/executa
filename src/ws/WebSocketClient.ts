import { getLogger } from '@stencila/logga'
import WebSocket, { CloseEvent, ErrorEvent, MessageEvent } from 'isomorphic-ws'
import retry from 'p-retry'
import { Client } from '../base/Client'
import { generate } from '../base/uid'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import {
  WebSocketAddress,
  WebSocketAddressInitializer,
} from '../base/Transports'
import { isOpen, send, generateProtocol } from './util'

const log = getLogger('executa:ws:client')

interface WebSocketClientOptions {
  /**
   * Should logging of connection errors etc be done?
   */
  logging: boolean

  /**
   * Seconds to wait for connection to be open
   * before sending a message.
   */
  timeout: number

  /**
   * Number of attempts to reconnect if
   * the connection is closed.
   */
  retries: number
}

const defaultWebSocketClientOptions: WebSocketClientOptions = {
  logging: true,
  timeout: 60,
  retries: 10,
}

/**
 * A `Client` using the WebSockets API for communication.
 */
export class WebSocketClient extends Client {
  /**
   * The address of the server to connect to.
   */
  public readonly address: WebSocketAddress

  /**
   * Options for this client.
   */
  public readonly options: WebSocketClientOptions

  /**
   * The `WebSocket` instance used for connections.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/WebSocket for
   * properties and methods.
   */
  private socket?: WebSocket

  /**
   * Has this client been explicitly stopped.
   *
   * Used to determine whether to try to reconnect.
   */
  private isStopped = false

  /**
   * Is this client attempting to reestablish a connection
   */
  public isRetrying: boolean | undefined

  /**
   * Construct a `WebSocketClient`.
   *
   * @param address The address of the server to connect to
   */
  public constructor(
    address: WebSocketAddressInitializer = new WebSocketAddress(),
    options: Partial<WebSocketClientOptions> = defaultWebSocketClientOptions
  ) {
    super('ws')
    this.address = new WebSocketAddress(address)
    this.options = { ...defaultWebSocketClientOptions, ...options }
  }

  private retryConnect = (
    resolve: (a: void | PromiseLike<void>) => void,
    reject: (a: Error) => void
  ): Promise<void> => {
    // Terminate early if already attempting to reconnect
    if (this.isRetrying === true) {
      return Promise.resolve()
    }

    this.isRetrying = true
    return retry(() => this.start(), {
      retries: this.options.retries,
      randomize: true,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        if (this.options.logging) {
          log.info(
            `Connection attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          )
        }
      },
    })
      .then(resolve)
      .catch(() => {
        reject(
          new Error(
            `Failed to reconnect after ${this.options.retries} attempt(s)`
          )
        )
      })
      .finally(() => {
        this.isRetrying = false
      })
  }

  /**
   * Start the connection.
   *
   * Creates a new WebSocket and sets up event handlers including
   * for automatically reconnecting if the connection is closed.
   */
  public start(): Promise<void> {
    const {
      id,
      address,
      options: { retries, logging },
    } = this
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(
        address.url(),
        generateProtocol(id, address.jwt)
      )

      this.socket.onopen = () => {
        this.isStopped = false
        resolve()
      }

      this.socket.onmessage = (event: MessageEvent) =>
        this.receive(event.data.toString())

      this.socket.onclose = (event: CloseEvent) => {
        // Try to reconnect if not explicitly closed or if
        // authentication failed
        if (this.isStopped) return resolve()

        const { code, reason } = event
        if (code === 4001) {
          const error = `Failed to authenticate with server: ${reason}`
          if (logging) {
            log.error(error)
          }

          reject(new Error(error))
        }

        if (retries > 0 && this.isRetrying === undefined) {
          // Configured to reconnect, but the process hasn't been started yet
          return this.retryConnect(resolve, reject)
        } else if (this.isRetrying === true) {
          // Configured to reconnect, and the process is already in progress
          return undefined
        } else {
          // Not configured to reconnect, or the reconnect process failed
          reject(new Error('Connection closed.'))
        }
      }

      this.socket.onerror = (error: ErrorEvent) => {
        if (logging) log.error(error.message)

        if (retries > 0 && this.isRetrying === undefined) {
          return this.retryConnect(resolve, reject)
        } else {
          reject(new Error(error.message))
        }
      }
    })
  }

  /**
   * @implements Implements {@link Client.send} to send
   * the request using the Websocket
   *
   * @description Will wait until the socket is open before
   * attempting to send the data.
   */
  protected async send(request: JsonRpcRequest): Promise<void> {
    const {
      socket,
      options: { timeout },
    } = this
    if (socket === undefined) {
      await this.start()
      return this.send(request)
    }
    return send(socket, JSON.stringify(request), timeout)
  }

  /**
   * @override Override of {@link Client.receive} to only
   * accept messages if the WebSocket is open.
   */
  protected receive(message: string): void {
    const {
      socket,
      options: { logging },
    } = this
    if (socket === undefined) return
    if (isOpen(socket)) super.receive(message)
    else if (logging)
      log.warn(`Message received while socket was closing: ${message}`)
  }

  /**
   * Stop the connection by closing the WebSocket.
   */
  public stop(): Promise<void> {
    this.isStopped = true
    if (this.socket !== undefined) this.socket.close()
    return Promise.resolve()
  }

  /**
   * @implements Implements {@link ClientType.discover}.
   *
   * @description Not implemented yet. In the future
   * could be implemented using port scanning on the
   * localhost.
   */
  static discover(): Promise<WebSocketClient[]> {
    log.warn('Discovery not available for WebSocket client')
    return Promise.resolve([])
  }
}
