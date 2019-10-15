import { Manifest } from '../base/Executor'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as util from 'util'
import { getLogger } from '@stencila/logga'

const glob = util.promisify(require('glob'))

const log = getLogger('executa:serve')

const EXECUTORS_DIR_NAME = 'executors'

export default async function discover(): Promise<Manifest[]> {
  let stencilaHome: string

  switch (os.platform()) {
    case 'darwin':
      stencilaHome = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        'Library',
        'Application Support',
        'Stencila'
      )
      break
    case 'linux':
      stencilaHome = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        '.stencila'
      )
      break
    case 'win32': // is 'win32' even on 64 bit windows systems
      stencilaHome = path.join(
        process.env.APPDATA !== undefined ? process.env.APPDATA : '',
        'Stencila'
      )
      break
    default:
      stencilaHome = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        'stencila'
      )
  }
  const executorsDir = path.join(stencilaHome, EXECUTORS_DIR_NAME)

  const manifests: Manifest[] = []

  const discoverDir = async (dir: string): Promise<Manifest | undefined> => {
    // Check the folder exists (they may not e.g. if no packages have been registered)
    try {
      fs.accessSync(dir, fs.constants.R_OK)
    } catch (error) {
      return
    }
    // For each host in the directory
    for (const file of await glob(path.join(dir, '*.json'))) {
      let json
      try {
        json = fs.readFileSync(file, { encoding: 'utf8' })
      } catch (error) {
        log.warn(`Warning: error reading file "${file}": ${error.message}`)
        continue
      }

      try {
        const manifest = JSON.parse(json) as Manifest
        log.info(`Added manifest at ${file}`)
        manifests.push(manifest)
      } catch (error) {
        log.warn(`Warning: error parsing file "${file}": ${error.message}`)
      }
    }
  }

  await discoverDir(executorsDir)
  return manifests
}
