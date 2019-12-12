// @ts-ignore
import externalIP from 'external-ip'
import os from 'os'
import { parseTcpAddress, deparseTcpAddress } from '../base/Transports'

// Cached IP values
let localIP_: string | undefined
let globalIP_: string | undefined

/**
 * Get the local IP address of the machine.
 *
 * Returns `127.0.0.1` if there is no external IP address.
 */
export function localIP(): string {
  if (localIP_ !== undefined) return localIP_

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === 'IPv4') {
        localIP_ = iface.address
        return localIP_
      }
    }
  }
  return '127.0.0.1'
}

/**
 * Get the global IP address of the machine.
 *
 * Returns `0.0.0.0` if unable to get global IP address.
 */
export function globalIP(): Promise<string> {
  if (globalIP_ !== undefined) return Promise.resolve(globalIP_)

  return new Promise(resolve =>
    externalIP({ getIP: 'parallel' })((error: Error | null, ip: string) => {
      if (error !== null) resolve('0.0.0.0')
      globalIP_ = ip
      resolve(ip)
    })
  )
}

/**
 * Create a list of addresses that a TCP, HTTP, or
 * WebSocket server can be reached at.
 *
 * This function is used to expand a single host address
 * so that peers that are close to the server
 * (i.e. share the same network or machine) can connect
 * more directly.
 */
export async function expandAddress(
  address: string,
  defaults = {
    scheme: 'ws',
    host: '0.0.0.0',
    port: 80
  }
): Promise<string[]> {
  const orig = parseTcpAddress(address, defaults)
  const { scheme, host, port } = orig

  // Use plain http and ws, not https and wss,
  // on local and localhost networks
  const insecure =
    scheme === 'https' || scheme === 'wss'
      ? {
          scheme: scheme.slice(0, -1),
          port: scheme === 'https' ? 8000 : 9000
        }
      : { scheme, port }

  const addresses = []
  if (host === '127.0.0.1' || host === 'localhost') {
    // No expansion necessary
    addresses.push(orig)
  } else {
    const local = await localIP()
    const match = /^\d+\.\d+\.\d+\.\d+$/.test(host)
    if (match && host !== '0.0.0.0') {
      // If the host is an IP (not a domain name) and not
      // the special `0.0.0.0` ("any IPv4 address at all")
      // then use that, the local IP (if different), and localhost
      addresses.push(orig)
      if (host !== local) addresses.push({ ...orig, ...insecure, host: local })
      addresses.push({ ...orig, ...insecure, host: '127.0.0.1' })
    } else {
      // Add the global IP to the list (if it is different),
      // plus local and localhost.
      const global = await globalIP()
      if (host !== '0.0.0.0') addresses.push(orig)
      if (host !== global) addresses.push({ ...orig, host: global })
      addresses.push({ ...orig, ...insecure, host: local })
      addresses.push({ ...orig, ...insecure, host: '127.0.0.1' })
    }
  }

  return addresses.map(deparseTcpAddress)
}
