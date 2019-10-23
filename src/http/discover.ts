import { Manifest } from '../base/Executor'
import { HttpAddress } from '../base/Transports'
import { HttpClient } from './HttpClient'

/**
 * Discover `HttpServer` instances.
 *
 * Currently just fetches a `Manifest` from a single `HttpAddress`.
 */
export async function discover(address?: HttpAddress): Promise<Manifest[]> {
  const client = new HttpClient(address)
  const manifest = await client.manifest()
  return [manifest]
}
