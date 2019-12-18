import * as os from 'os'
import * as path from 'path'

/**
 * Get the Stencila home directory.
 *
 * Used for registration and discovery of
 * executors on the current machine, caches
 * and history files etc
 */
export function home(...subpath: string[]): string {
  let home: string
  switch (os.platform()) {
    case 'darwin':
      home = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        'Library',
        'Application Support',
        'Stencila'
      )
      break
    case 'linux':
      home = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        '.stencila'
      )
      break
    case 'win32':
      home = path.join(
        process.env.APPDATA !== undefined ? process.env.APPDATA : '',
        'Stencila'
      )
      break
    default:
      home = path.join(
        process.env.HOME !== undefined ? process.env.HOME : '',
        'stencila'
      )
  }
  return path.join(home, ...subpath)
}
