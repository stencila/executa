import * as os from 'os'
import * as path from 'path'

/**
 * Get the home directory of executors.
 *
 * Used for bother registration and discovery of
 * executors on the current machine.
 */
export function home(): string {
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
    case 'win32':
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
  return path.join(stencilaHome, 'executors')
}
