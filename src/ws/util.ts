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
 * Wait until a socket is in the open state?
 *
 * @param socket The Websocket to wait for
 */
export function untilOpen(socket: WebSocket): Promise<void> {
  if (isClosingOrClosed(socket))
    throw new Error('Websocket is closing or closed')
  if (socket.readyState !== WebSocket.OPEN) {
    return new Promise(resolve => {
      socket.onopen = () => resolve()
    })
  }
  return Promise.resolve()
}

/**
 * Send data on a Websocket
 *
 * @param socket The WebSocket to send on
 * @param data The data to send
 */
export async function send(socket: WebSocket, data: string): Promise<void> {
  await untilOpen(socket)
  socket.send(data)
}
