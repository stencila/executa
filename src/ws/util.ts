/**
 * Utility function for using WebSockets
 */

import WebSocket from 'isomorphic-ws'
import { Id } from '../base/uid'

/**
 * Generate the `Sec-Websocket-Protocol` header.
 *
 * This is the only header that can be set in the WebSocket constructor
 * and we use it to pass client id and JWT to the server.
 * The generated header follows the recommendations of
 * https://tools.ietf.org/html/rfc6455#section-1.9 with `+`
 * used as a separator between its parts.
 *
 * @param id The id of the client
 * @param jwt A JWT
 */
export function generateProtocol(id: string, jwt?: string): string {
  return `executa.stenci.la+1+${id}` + (jwt !== undefined ? `+${jwt}` : '')
}

/**
 * Parse the `Sec-Websocket-Protocol` header.
 *
 * @param protocol The protocol header
 * @returns The id and jwt in the header
 */
export function parseProtocol(protocol: string): { id: string; jwt?: string } {
  const match = /executa\.stenci\.la\+1\+([^+]+)(?:\+([^+]+))?/.exec(protocol)
  if (match === null)
    throw new Error(`Unable to parse the WebSocket protocol header`)
  const [_, id, jwt] = match
  return { id, jwt }
}

/**
 * Is a WebSocket in the open state?
 *
 * @param socket The WebSocket to check
 */
export function isOpen(socket: WebSocket): boolean {
  return socket.readyState === WebSocket.OPEN
}

/**
 * Is a WebSocket in the closing or closed state?
 *
 * @param socket The WebSocket to check
 */
export function isClosingOrClosed(socket: WebSocket): boolean {
  return (
    socket.readyState === WebSocket.CLOSING ||
    socket.readyState === WebSocket.CLOSED
  )
}

/**
 * Wait until a socket is in the open state.
 *
 * @param socket The WebSocket to wait for
 * @param timeout The number of seconds to wait for the socket
 *                to be open before throwing a timeout error
 */
export function untilOpen(socket: WebSocket, timeout = 60): Promise<void> {
  if (isClosingOrClosed(socket))
    throw new Error('WebSocket is closing or closed')
  if (socket.readyState !== WebSocket.OPEN) {
    return new Promise((resolve, reject) => {
      let open = false
      socket.onopen = () => {
        open = true
        resolve()
      }
      setTimeout(() => {
        if (!open) reject(new Error('WebSocket timeout'))
      }, timeout * 1000)
    })
  }
  return Promise.resolve()
}

/**
 * Send data on a WebSocket connection.
 *
 * @param socket The WebSocket to send data on
 * @param data The data to send
 * @param timeout The number of seconds to wait for the socket
 *                to be open before throwing a timeout error
 */
export async function send(
  socket: WebSocket,
  data: string,
  timeout = 60
): Promise<void> {
  await untilOpen(socket, timeout)
  socket.send(data)
  return Promise.resolve()
}
