import { TcpAddress } from '../base/Transports'
import { Manifest } from '../base/Executor'
import TcpClient from './TcpClient'

/**
 * Discover `TcpServer` instances.
 *
 * Currently just fetches the `Manifest` from a single `TcpAddress`
 * but could in the future do port scanning.
 */
export default async function discover(
  address?: TcpAddress
): Promise<Manifest[]> {
  const client = new TcpClient(address)
  const manifest = await client.manifest()
  client.stop()
  return [manifest]
}
