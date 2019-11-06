import { Node } from '@stencila/schema'

/**
 * A `Server` side connection to a `Client`.
 *
 * This interface is used by server classes that
 * have more than one, persistent connections
 * (e.g. `TcpServer` and `WebSocketServer`).
 */
export interface Connection {
  /**
   * A unique identifier for the connection.
   */
  id: string

  /**
   * Send a notification to the client at the other
   * end of the connection.
   *
   * @param level The notification level
   * @param message The notification message
   * @param node The notification subject
   *
   * @see Executor#notify
   * @see Server#notify
   * @see Client#notify
   */
  notify(level: string, message: string, node?: Node): void

  /**
   * Stop the connection.
   */
  stop(): Promise<void>
}
