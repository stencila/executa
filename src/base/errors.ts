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
 */
import { Method, Params } from './Executor'
import { isEntity, nodeType } from '@stencila/schema'

export class InternalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InternalError'
  }
}

export class MethodUnknownError extends Error {
  /**
   * The name of the parameter that is required.
   */
  method: string

  constructor(method: string) {
    super(`Method "${method}" is unknown`)
    this.name = 'MethodUnknownError'
    this.method = method
  }
}

export class ParamRequiredError extends Error {
  /**
   * The name of the parameter that is required.
   */
  param: string

  constructor(param: string) {
    super(`Parameter "${param}" is required`)
    this.name = 'ParamRequiredError'
    this.param = param
  }
}

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
  constructor(message = 'Incapable', method?: Method, params: Params = {}) {
    super(
      method !== undefined
        ? CapabilityError.message(message, method, params)
        : message
    )
    this.name = 'CapabilityError'
  }

  static message(message: string, method: Method, params: Params): string {
    return (
      `${message}: method "${method}" with params:\n` +
      Object.entries(params)
        .map(([name, value]) => {
          let repr
          if (isEntity(value)) {
            repr = `<${nodeType(value)}>`
          } else {
            repr = JSON.stringify(value)
            if (repr !== undefined && repr.length > 20) {
              repr = repr.slice(0, 20) + '...'
            }
          }
          return `  ${name}: ${repr}`
        })
        .join('\n')
    )
  }
}
