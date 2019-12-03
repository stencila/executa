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
  constructor(message: string) {
    super(message)
    this.name = 'CapabilityError'
  }
}
