export enum Transport {
  direct = 'direct',
  stdio = 'stdio',
  vsock = 'vsock',
  tcp = 'tcp',
  http = 'http',
  ws = 'ws'
}

export interface DirectAddress {
  type: Transport.direct
  server: any
}

export interface StdioAddress {
  type: Transport.stdio
  command: string
  args?: string[]
  cwd?: string
}

export class VsockAddress {
  public readonly type: Transport.vsock = Transport.vsock

  public readonly port: number

  public constructor (port: number = 6000) {
    this.port = port
  }
}

export type TcpAddressInitializer =
  | number
  | string
  | { host: string; port: number }

export class TcpAddress {
  public readonly type: Transport.tcp | Transport.http | Transport.ws =
    Transport.tcp

  public readonly host: string

  public readonly port: number

  public constructor(
    address?: TcpAddressInitializer,
    defaults: {
      host: string
      port: number
    } = {
      host: '127.0.0.1',
      port: 2000
    }
  ) {
    const { host, port } = (function() {
      if (address === undefined) {
        return defaults
      } else if (typeof address === 'string') {
        const parts = address.split(':')
        if (parts.length === 1) {
          return {
            host: defaults.host,
            port: parseInt(parts[0])
          }
        } else if (parts.length >= 2) {
          return {
            host: parts[0],
            port: parseInt(parts[1])
          }
        } else {
          return defaults
        }
      } else if (typeof address === 'number') {
        return { host: defaults.host, port: address }
      } else {
        const { host = defaults.host, port = defaults.port } = address
        return { host, port }
      }
    })()
    this.host = host
    this.port = port
  }

  public toString(): string {
    return `${this.type}://${this.host}:${this.port}`
  }
}

export class HttpAddress extends TcpAddress {
  public readonly type: Transport.http | Transport.ws = Transport.http

  public readonly jwt?: string

  public constructor(address?: TcpAddressInitializer, jwt?: string) {
    super(address, {
      host: '127.0.0.1',
      port: 8000
    })
    this.jwt = jwt
  }
}

export class WebSocketAddress extends HttpAddress {
  public readonly type: Transport.ws = Transport.ws
}

export type Address =
  | DirectAddress
  | StdioAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebSocketAddress
