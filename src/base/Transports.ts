import { InternalError } from './InternalError'

export enum Transport {
  direct = 'direct',
  stdio = 'stdio',
  uds = 'uds',
  vsock = 'vsock',
  tcp = 'tcp',
  http = 'http',
  ws = 'ws'
}

export type Address =
  | DirectAddress
  | StdioAddress
  | UdsAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebSocketAddress

export class DirectAddress {
  public readonly type: Transport.direct = Transport.direct
  public readonly server: any
}

export type StdioAddressInitializer =
  | string
  | Pick<StdioAddress, 'command' | 'args' | 'cwd'>
export class StdioAddress {
  public readonly type: Transport.stdio = Transport.stdio
  public readonly command: string
  public readonly args?: string[]
  public readonly cwd?: string

  public constructor(address: StdioAddressInitializer) {
    if (typeof address === 'string') {
      const parts = address.split(/\s/)
      this.command = parts[0]
      this.args = parts.slice(1)
    } else {
      this.command = address.command
      this.args = address.args
      this.cwd = address.cwd
    }
  }
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

export interface TcpAddressProperties {
  scheme: string
  host: string
  port: number
}

export type TcpAddressInitializer =
  | number
  | string
  | Partial<TcpAddressProperties>

export class TcpAddress {
  public readonly type: Transport.tcp | Transport.http | Transport.ws =
    Transport.tcp

  public readonly scheme: string

  public readonly host: string

  public readonly port: number

  public constructor(
    address?: TcpAddressInitializer,
    defaults: TcpAddressProperties = {
      scheme: 'tcp',
      host: '127.0.0.1',
      port: 7000
    }
  ) {
    const { scheme, host, port } = parseAddress(address, defaults)
    this.scheme = scheme
    this.host = host
    this.port = port
  }

  public url(): string {
    return `${this.scheme}://${this.host}:${this.port}`
  }
}

export interface HttpAddressProperties extends TcpAddressProperties {
  path?: string
  jwt?: string
  protocol?: 'jsonrpc' | 'restful'
}

export type HttpAddressInitializer =
  | number
  | string
  | Partial<HttpAddressProperties>

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
  public readonly path?: string

  /**
   * The JSON Web Token (JWT) to use add to requests
   * to this address.
   */
  public readonly jwt?: string

  /**
   * The API protocol to use.
   *
   * When `jsonrpc`, then all requests and responses should be within
   * a JSON-RPC envelope with `id`, `method`, `params` etc.
   *
   * When `restful`, then the HTTP path is the method (e.g. `/manifest`)
   * and the body is the `params` object. (This isn't really RESTful,
   * but the API calls are stylistically similar ¯\_(ツ)_/¯)
   */
  public readonly protocol?: 'jsonrpc' | 'restful'

  public constructor(
    address?: HttpAddressInitializer,
    defaults: HttpAddressProperties = {
      scheme: 'http',
      host: '127.0.0.1',
      port: 80
    }
  ) {
    super(address, defaults)
    const { path } = parseAddress(address, defaults)
    this.path = path
    if (typeof address === 'object') {
      const { protocol, jwt } = address
      this.protocol = protocol
      this.jwt = jwt
    }
  }

  public url(): string {
    const { scheme, host, port, path } = this
    let url = `${scheme}://${host}`
    if (
      ((scheme === 'http' || scheme === 'ws') && port !== 80) ||
      ((scheme === 'https' || scheme === 'wss') && port !== 443)
    )
      url += `:${port}`
    if (path !== undefined) {
      if (!path.startsWith('/')) url += '/'
      url += path
    }
    return url
  }
}

export type WebSocketAddressInitializer = HttpAddressInitializer

export class WebSocketAddress extends HttpAddress {
  public readonly type: Transport.ws = Transport.ws

  public constructor(address?: WebSocketAddressInitializer) {
    super(address, {
      scheme: 'ws',
      host: '127.0.0.1',
      port: 80
    })
  }
}

export function parseAddress(
  address: undefined | TcpAddressInitializer | HttpAddressInitializer,
  defaults: TcpAddressProperties | HttpAddressProperties
): Pick<HttpAddressProperties, 'scheme' | 'host' | 'port' | 'path'> {
  let { scheme, host, path } = { path: undefined, ...defaults }
  let port
  if (typeof address === 'string') {
    // Parse as string of port number (useful for C)
    const match = /^[0-9]{2,5}$/.exec(address)
    if (match !== null) {
      port = parseInt(match[0])
    } else {
      // Parse string to extract parts
      const match = /(([a-z]{2,5}):\/\/)?([^:/]+)(:(\d+))?(\/(.+))?$/.exec(
        address
      )
      if (match === null)
        throw new InternalError(`Could not parse address "${address}"`)
      if (match[2] !== undefined) scheme = match[2]
      if (match[3] !== undefined) host = match[3]
      if (match[5] !== undefined) port = parseInt(match[5])
      if (match[7] !== undefined) path = match[7]
    }
  } else if (typeof address === 'number') {
    // Port number provided only
    port = address
  } else {
    // Merge address object over the top of defaults
    ;({ scheme, host, port, path } = { scheme, host, port, path, ...address })
  }
  // If port is still undefined then infer it from scheme, or apply default
  if (port === undefined) {
    if (scheme === 'http' || scheme === 'ws') port = 80
    else if (scheme === 'https' || scheme === 'wss') port = 443
    else port = defaults.port
  }
  return { scheme, host, port, path }
}
