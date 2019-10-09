import StdioClient from './StdioClient'

export class ExecutionClient extends StdioClient {
  private readonly programmingLanguage: string

  public constructor(
    command: string,
    args: string[],
    options: object = { shell: true },
    programmingLanguage: string
  ) {
    super(command, args, options)
    this.programmingLanguage = programmingLanguage
  }

  public capable(method: string, node: any): boolean {
    return (
      method === 'execute' &&
      node.node !== undefined &&
      node.node.programmingLanguage === this.programmingLanguage
    )
  }
}
