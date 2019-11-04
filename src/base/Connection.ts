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
   * @param subject The notification subject
   * @param message The notification message
   *
   * @see Executor#notify
   * @see Client#notify
   */
  notify(subject: string, message: string): void

  /**
   * Stop the connection.
   */
  stop(): Promise<void>
}
