import { getLogger } from '@stencila/logga'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import { Manifest } from '../base/Executor'
import {
  StdioAddress,
  StdioAddressInitializer,
  Addresses,
  Transport
} from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'
import { home } from './util'

const log = getLogger('executa:stdio:server')

export class StdioServer extends StreamServer {
  private address: StdioAddress

  constructor(address?: StdioAddressInitializer) {
    super()
    this.address = new StdioAddress(
      address !== undefined
        ? address
        : {
            command: process.argv[0],
            args: process.argv.slice(1)
          }
    )
  }

  /**
   * @implements Implements {@link Server.addresses}.
   */
  public addresses(): Promise<Addresses> {
    return Promise.resolve({
      [Transport.stdio]: this.address
    })
  }

  /**
   * Register an executor that has a `StdioServer` on the
   * current machine, so that it can be discovered by a `StdioClient`.
   *
   * @see {@link StdioClient.discover}
   *
   * @param name The name of executor.
   * @param manifest The executor's manifest.
   */
  public static register(name: string, manifest: Manifest) {
    const dir = home()

    log.info(`Registering executor "${name}" in folder "${dir}"`)
    mkdirp.sync(dir)

    const { addresses = {} } = manifest
    if (addresses.stdio === undefined) {
      log.warn('Manifest does not include a STDIO address')
    }

    fs.writeFileSync(
      path.join(dir, name + '.json'),
      JSON.stringify(manifest, null, '  '),
      'utf8'
    )
  }
}
