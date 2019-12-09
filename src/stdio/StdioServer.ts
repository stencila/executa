import fs from 'fs'
import path from 'path'
import { Manifest } from '../base/Executor'
import { StdioAddress, StdioAddressInitializer } from '../base/Transports'
import { StreamServer } from '../stream/StreamServer'
import { home } from './util'
import { getLogger } from '@stencila/logga'

const log = getLogger('executa:stdio:server')

export class StdioServer extends StreamServer {
  private address_: StdioAddress

  constructor(address?: StdioAddressInitializer) {
    super()
    this.address_ = new StdioAddress(
      address !== undefined
        ? address
        : {
            command: process.argv[0],
            args: process.argv.slice(1)
          }
    )
  }

  public get address(): StdioAddress {
    return this.address_
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
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

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
