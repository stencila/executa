export enum Transport {
  stdio = 'stdio',
  vsock = 'vsock',
  tcp = 'tcp',
  http = 'http',
  ws = 'ws'
}

export interface StdioAddress {
  type: Transport.stdio
  command: string
  args?: string[]
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

export interface HttpAddress extends TcpAddress {
  type: Transport.http | Transport.ws
  jwt?: string
}

export interface WebsocketAddress extends HttpAddress {
  type: Transport.ws
}

export type Address =
  | StdioAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebsocketAddress
