/**
 * Internal error
 *
 * This custom error class simply serves to identify
 * errors that should only occur due to problems with
 * internal code (e.g. not overriding a base method properly) or
 * configuration (e.g. not setting an environment variable).
 *
 * Messages should be written for developers using this library,
 * not for end users.
 *
 * @see JsonRpcError
 */
export class InternalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InternalError'
  }
}
