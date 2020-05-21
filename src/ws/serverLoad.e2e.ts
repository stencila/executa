/**
 * A script for testing sending several messages of increasing sizes to
 * various WebSocket server implementations with different client creation
 * strategies (one, each with many requests vs many, each with one request).
 *
 * Run like this (one process for server, one for client/s):
 *
 * ```sh
 * npx ts-node --project tsconfig.cli.json  --files src/ws/serverLoad.e2e.ts server-ws
 * ```
 *
 * Written to try to resolve issue https://github.com/stencila/executa/issues/141.
 * These results, showing the highest exponent / repetition befor hanging
 * suggest that problem resides in the fastify server:
 *
 * Combo                                Exponent   Replicate
 *
 * `server-executa` + `client-one`:        9        6
 * `server-executa` + `client-many`:      19        9
 *
 * `server-fastify` + `client-one`:        9        6
 * `server-fastify` + `client-many`:      19        9
 *
 * `server-ws` + `client-one`:            19        9
 * `server-ws` + `client-many`:           19        9
 */


import fastify from 'fastify'
import fastifyWebsocket from 'fastify-websocket'
import WebSocket from 'ws'
import { JsonRpcRequest } from '../base/JsonRpcRequest'
import { Worker } from '../base/Worker'
import { WebSocketServer } from './WebSocketServer'

const mode = process.argv[2]

if (mode === 'server-executa') {
  /**
   * Run Executa's `WebSocketServer`
   */
  const server = new WebSocketServer()
  const executor = new Worker()
  server.start(executor)
} else if (mode === 'server-fastify') {
  /**
   * Run `fastify` server with the `fastify-websocket`
   * plugin. This is what Executa's `WebSocketServer`
   * is currently built on.
   */
  const server = fastify()
  server.register(fastifyWebsocket, {
    handle: (connection: any) => {
      const { socket } = connection
      socket.on('message', (message: string) => {
        console.log('recv', message.substring(0, 60))
        socket.send(message, (error: any) => {
          if (error !== undefined) {
            console.error(error)
            process.exit(1)
          }
          console.log('sent', message.substring(0, 60))
        })
      })
    }
  })
  server.listen(9000)
} else if (mode === 'server-ws') {
  /**
   * Run a `ws` server.  This is what `fastify-websocket`
   * is built on.
   */
  const server = new WebSocket.Server({
    port: 9000
  })
  server.on('connection', socket => {
    socket.on('message', message => {
      console.log('recv', message.toString().substring(0, 60))
      socket.send(message, error => {
        if (error !== undefined) {
          console.error(error)
          process.exit(1)
        }
        console.log('sent', message.toString().substring(0, 60))
      })
    })
  })
} else if (mode === 'client-one') {
  /**
   * Create one plain `WebSocket` client and
   * make multiple requests of increasing payload size
   */
  let exponent = 1
  let replicate = 0
  function send() {
    if (exponent > 19) process.exit(0)
    else if (replicate >= 9) {
      exponent += 1
      replicate = 1
    } else replicate += 1

    const size = Math.pow(2, exponent)
    const payload = JSON.stringify(
      `${exponent}:${replicate}:` + '-'.repeat(size)
    )
    const request = new JsonRpcRequest('decode', {
      source: payload,
      format: 'json'
    })
    const message = JSON.stringify(request)
    client.send(message, error => {
      if (error !== undefined) {
        console.error(error)
        process.exit(1)
      }
      console.log('sent', exponent, replicate, message.substring(0, 60))
    })
  }
  const client = new WebSocket('ws://127.0.0.1:9000')
  client
    .on('open', () => {
      send()
    })
    .on('error', err => {
      console.error(`Connection error: ${err}`)
      process.exit(1)
    })
    .on('close', () => {
      console.log('Connection closed')
      process.exit(0)
    })
    .on('message', (message: string) => {
      console.log('recv', exponent, replicate, message.substring(0, 60))
      send()
    })
} else if (mode === 'client-many') {
  /**
   * Create many `WebSocket` clients, one for each of
   * multiple requests of increasing payload size.
   */
  for (let exponent = 1; exponent < 20; exponent++) {
    for (let replicate = 0; replicate < 10; replicate++) {
      const client = new WebSocket('ws://127.0.0.1:9000')
      client
        .on('open', () => {
          const size = Math.pow(2, exponent)
          const payload = JSON.stringify(
            `${exponent}:${replicate}:` + '-'.repeat(size)
          )
          const request = new JsonRpcRequest('decode', {
            source: payload,
            format: 'json'
          })
          const message = JSON.stringify(request)
          client.send(message, error => {
            if (error !== undefined) console.error(error)
            console.log('sent', exponent, replicate, message.substring(0, 60))
          })
        })
        .on('error', err => {
          console.error(`Connection error: ${err}`)
          process.exit(1)
        })
        .on('close', () => {
          console.log('Connection closed')
          process.exit(0)
        })
        .on('message', (message: string) => {
          console.log('recv', exponent, replicate, message.substring(0, 60))
        })
    }
  }
}
