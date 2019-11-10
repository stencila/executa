/**
 * Utility function for using WebSockets
 */

import WebSocket from 'isomorphic-ws'

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
  return new Promise((resolve, reject) => {
    socket.send(data, error => {
      if (error !== undefined) reject(error)
      else resolve()
    })
  })
}
