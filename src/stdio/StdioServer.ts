import StreamServer from '../stream/StreamServer'
import Executor from '../base/Executor'

export default class StdioServer extends StreamServer {
  constructor(executor?: Executor) {
    super(executor)
  }

  start(): void {
    super.start(process.stdin, process.stdout)
  }
}
