export enum Transport {
  direct = 'direct',
  stdio = 'stdio',
  uds = 'uds',
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

/**
 * An address in the Unix Domain Socket (UDS) address family
 *
 * @see https://en.wikipedia.org/wiki/Unix_domain_socket
 */
export class UdsAddress {
  public readonly type: Transport.uds = Transport.uds

  /**
   * The file system path to the socket
   */
  public readonly path: string

  public constructor(path: string) {
    this.path = path
  }
}

/**
 * An address in the Linux VSOCK address family
 *
 * @see http://man7.org/linux/man-pages/man7/vsock.7.html
 */
export class VsockAddress {
  public readonly type: Transport.vsock = Transport.vsock

  /**
   * The port number
   */
  public readonly port: number

  /**
   * The file system path to the socket
   *
   * Although VSOCK addresses do not include a path,
   * Firecracker uses a UDS on the host. This allows
   * for that use case.
   */
  public readonly path?: string

  public constructor(port = 6000, path?: string) {
    this.port = port
    this.path = path
  }
}

export type TcpAddressInitializer =
  | number
  | string
  | { host: string; port: number }

export type TcpAddressDefaults = { host: string; port: number }

export class TcpAddress {
  public readonly type: Transport.tcp | Transport.http | Transport.ws =
    Transport.tcp

  public readonly host: string

  public readonly port: number

  public constructor(
    address?: TcpAddressInitializer,
    defaults: TcpAddressDefaults = {
      host: '127.0.0.1',
      port: 7000
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

/**
 * An address in the HTTP address family
 *
 * @see https://www.w3.org/Addressing/HTTPAddressing.html
 */
export class HttpAddress extends TcpAddress {
  public readonly type: Transport.http | Transport.ws = Transport.http

  /**
   * The path for the address.
   *
   * Should begin with a forward slash e.g. `/some/route`
   */
  public readonly path: string

  /**
   * The JSON Web Token (JWT) to use add to requests
   * to this address.
   */
  public readonly jwt?: string

  public constructor(
    address?: TcpAddressInitializer,
    path = '',
    jwt?: string,
    defaults: TcpAddressDefaults = {
      host: '127.0.0.1',
      port: 8000
    }
  ) {
    super(address, defaults)
    this.path = path
    this.jwt = jwt
  }

  public toString(): string {
    return `${super.toString()}${this.path}`
  }
}

export class WebSocketAddress extends HttpAddress {
  public readonly type: Transport.ws = Transport.ws

  public constructor(address?: TcpAddressInitializer, path = '', jwt?: string) {
    super(address, path, jwt, {
      host: '127.0.0.1',
      port: 9000
    })
  }
}

export type Address =
  | DirectAddress
  | StdioAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebSocketAddress
