import StreamServer from '../stream/StreamServer'

export default class StdioServer extends StreamServer {
  public start(): void {
    super.start(process.stdin, process.stdout)
  }
}
