import Client from './Client'
import { ExecutionClient } from '../stdio/ExecutionClient'

enum ExecutorType {
  subprocess = 'subprocess'
}

interface SubprocessOptions {
  spawn: string[]
  shell?: boolean
  cwd?: string
}

interface Manifest {
  id: string
  executorType: ExecutorType
  programmingLanguage?: string
  options?: SubprocessOptions
}

export class ManifestFacade {
  public static getPeers(): Client[] {
    return ManifestFacade.getManifests()
      .map(manifest => {
        if (manifest.executorType !== ExecutorType.subprocess) return null
        if (manifest.options === undefined) return null
        if (manifest.programmingLanguage === undefined) return null

        const { spawn, ...rest } = manifest.options
        const [command, ...commandArgs] = manifest.options.spawn
        return new ExecutionClient(
          command,
          commandArgs,
          rest,
          manifest.programmingLanguage
        )
      })
      .filter(c => c != null) as Client[]
  }

  public static getManifests(): Manifest[] {
    return [
      {
        id: 'python',
        programmingLanguage: 'python',
        executorType: ExecutorType.subprocess,
        options: {
          spawn: ['python3', '-m', 'stencila.schema', 'listen']
        }
      },
      {
        id: 'javascript',
        programmingLanguage: 'javascript',
        executorType: ExecutorType.subprocess,
        options: {
          spawn: [
            'npx',
            'ts-node',
            '/Users/ben/Documents/stencila/schema/ts/interpreter',
            'listen'
          ],
          cwd: '/Users/ben/Documents/stencila/schema'
        }
      }
    ]
  }
}
