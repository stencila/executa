import { Method, Params } from './Executor'

/**
 * Capability error
 *
 * This custom error class to indicate that
 * an executor is not capable of performing a
 * method call.
 *
 * Messages should be written for developers using this library,
 * not for end users.
 */
export class CapabilityError extends Error {
  constructor(message: string | Method, params: Params = {}) {
    super(
      typeof message === 'string'
        ? message
        : `Incapable of method "${message}" with params "${JSON.stringify(
            params
          ).slice(0, 256)}"`
    )
    this.name = 'CapabilityError'
  }
}
