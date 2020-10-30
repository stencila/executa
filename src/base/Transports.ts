import { InternalError } from './errors'

export enum Transport {
  direct = 'direct',
  stdio = 'stdio',
  pipe = 'pipe',
  uds = 'uds',
  vsock = 'vsock',
  tcp = 'tcp',
  http = 'http',
  ws = 'ws',
}

export class DirectAddress {
  public readonly type: Transport.direct = Transport.direct
  public readonly server: any

  public constructor(server: any) {
    this.server = server
  }

  public url(): string {
    return `direct://`
  }
}

export type DirectAddressInitializer = Pick<DirectAddress, 'server'>

export type StdioAddressInitializer =
  | string
  // eslint-disable-next-line no-use-before-define
  | Pick<StdioAddress, 'command' | 'args' | 'cwd'>
export class StdioAddress {
  public readonly type: Transport.stdio = Transport.stdio
  public readonly command: string
  public readonly args?: string[]
  public readonly cwd?: string

  public constructor(address: StdioAddressInitializer) {
    if (typeof address === 'string') {
      const match = /^stdio:\/\/(.*)$/.exec(address)
      if (match !== null) address = match[1]
      const parts = address.split(/\s/)
      this.command = parts[0]
      // Remove surrounding quotes from arguments to support
      // shell style command lines
      this.args = parts
        .slice(1)
        .map((arg) =>
          (arg.startsWith('"') && arg.endsWith('"')) ||
          (arg.startsWith("'") && arg.endsWith("'"))
            ? arg.slice(1, -1)
            : arg
        )
    } else {
      this.command = address.command
      this.args = address.args
      this.cwd = address.cwd
    }
  }

  public url(): string {
    const { command, args } = this
    let url = `stdio://${command}`
    if (args !== undefined) url += ' ' + args.join(' ')
    return url
  }
}

/**
 * An initializer for a `PipeAddress`.
 */
export type PipeAddressInitializer = string

/**
 * An address representing the base path to a pair
 * of named pipes `<address>.in` and `<address>.out`.
 * Other files may be associated with this address e.g. `<address>.lock`.
 *
 * @see {@link https://en.wikipedia.org/wiki/Named_pipe Wikipedia}
 */
export class PipeAddress extends String {
  public readonly type: Transport.pipe = Transport.pipe

  public constructor(address: PipeAddressInitializer) {
    super(address.startsWith('pipe://') ? address.slice(7) : address)
  }

  public url(): string {
    return `pipe://${this}`
  }
}

/**
 * An address in the Unix Domain Socket (UDS) address family
 *
 * @see {@link https://en.wikipedia.org/wiki/Unix_domain_socket Wikipedia}
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

  public url(): string {
    return `uds://${this.path}`
  }
}

/**
 * An address in the Linux VSOCK address family
 *
 * @see {@link http://man7.org/linux/man-pages/man7/vsock.7.html Linux man page}
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

  public url(): string {
    const { port, path } = this
    let url = `vsock://${port}`
    if (path !== undefined) url += ' ' + path
    return url
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
      port: 7000,
    }
  ) {
    const { scheme, host, port } = parseTcpAddress(address, defaults)
    this.scheme = scheme
    this.host = host
    this.port = port
  }

  public url(): string {
    return deparseTcpAddress(this)
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
 * @see {@link https://www.w3.org/Addressing/HTTPAddressing.html HTTP Addressing }
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
      port: 80,
    }
  ) {
    super(address, defaults)
    const { path } = parseTcpAddress(address, defaults)
    this.path = path
    if (typeof address === 'object') {
      const { protocol, jwt } = address
      this.protocol = protocol
      this.jwt = jwt
    }
  }
}

export type WebSocketAddressInitializer = HttpAddressInitializer

export class WebSocketAddress extends HttpAddress {
  public readonly type: Transport.ws = Transport.ws

  public constructor(address?: WebSocketAddressInitializer) {
    super(address, {
      scheme: 'ws',
      host: '127.0.0.1',
      port: 80,
    })
  }
}

export type Address =
  | DirectAddress
  | StdioAddress
  | PipeAddress
  | UdsAddress
  | VsockAddress
  | TcpAddress
  | HttpAddress
  | WebSocketAddress

export interface Addresses {
  direct?: DirectAddressInitializer
  stdio?: StdioAddressInitializer
  pipe?: PipeAddressInitializer
  uds?: UdsAddress
  vsock?: VsockAddress
  tcp?: TcpAddressInitializer | TcpAddressInitializer[]
  http?: HttpAddressInitializer | HttpAddressInitializer[]
  ws?: WebSocketAddressInitializer | WebSocketAddressInitializer[]
}

export function parseTcpAddress(
  address: undefined | TcpAddressInitializer | HttpAddressInitializer,
  defaults: TcpAddressProperties | HttpAddressProperties
): Pick<HttpAddressProperties, 'scheme' | 'host' | 'port' | 'path'> {
  let { scheme, host, path } = { path: undefined, ...defaults }
  let port
  if (typeof address === 'string') {
    // Attempt to parse string as port number
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

/**
 * Create a URL from a TCP-based address. Inverse of `parseTcpAddress`.
 *
 * @param address The address to deparse.
 */
export function deparseTcpAddress(
  address: Pick<HttpAddressProperties, 'scheme' | 'host' | 'port' | 'path'>
): string {
  const { scheme, host, port, path } = address
  let url = `${scheme}://${host}`
  // Only add port number if necessary
  if (
    scheme === 'tcp' ||
    ((scheme === 'http' || scheme === 'ws') && port !== 80) ||
    ((scheme === 'https' || scheme === 'wss') && port !== 443)
  )
    url += `:${port}`
  // Add path for HTTP and WebSocket addresses
  if (scheme !== 'tcp' && path !== undefined) {
    if (!path.startsWith('/')) url += '/'
    url += path
  }
  return url
}

export function parseAddress(address: string): Address | undefined {
  const match = /^([a-zA-Z]+):\/\/(.*)$/.exec(address)
  if (match !== null) {
    const scheme = match[1]
    const rest = match[2]
    switch (scheme) {
      case 'docker':
        return new StdioAddress(`docker run --interactive ${rest}`)
      case 'http':
      case 'https':
        return new HttpAddress(address)
      case 'pipe':
        return new PipeAddress(address)
      case 'stdio':
        return new StdioAddress(address)
    }
  }
  return undefined
}
