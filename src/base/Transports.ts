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

export interface VsockAddress {
  type: Transport.vsock
  port?: number
  cid?: number
}

export interface TcpAddress {
  type: Transport.tcp | Transport.http | Transport.ws
  host?: string
  port?: number
}

export function tcpAddress(
  address: undefined | string | number | Omit<TcpAddress, 'type'>,
  defaults: {
    host: string
    port: number
  }
): Required<Omit<TcpAddress, 'type'>> {
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
    return { host: defaults.host, port: address}
  } else {
    const { host = defaults.host, port = defaults.port } = address
    return { host, port }
  }
}

export interface HttpAddress extends TcpAddress {
  type: Transport.http | Transport.ws
  jwt?: string
}

export interface WebsocketAddress extends HttpAddress {
  type: Transport.ws
}

export type Address =
  | DirectAddress
  | StdioAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebsocketAddress
