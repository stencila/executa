import { CapabilityError } from './CapabilityError'

/**
 * A JSON-RPC 2.0 response error
 *
 * @see {@link https://www.jsonrpc.org/specification#error_object}
 */

/**
 * Error codes defined in JSON-RPC 2.0
 *
 * Codes -32000 to -32099	are reserved for implementation-defined server-errors.
 */
export enum JsonRpcErrorCode {
  /**
   * Invalid JSON was received by the server.
   * An error occurred on the server while parsing the JSON text.
   */
  ParseError = -32700,

  /**
   * The JSON sent is not a valid Request object.
   */
  InvalidRequest = -32600,

  /**
   * The method does not exist / is not available.
   */
  MethodNotFound = -32601,

  /**
   * Invalid method parameter(s).
   */
  InvalidParams = -32602,

  /**
   * Internal JSON-RPC error.
   */
  InternalError = -32603,

  // Implementation defined server-errors...

  /**
   * Generic server error.
   */
  ServerError = -32000,

  /**
   * Capability error
   **/
  CapabilityError = -32005
}

export class JsonRpcError {
  public readonly name = 'JsonRpcError'

  /**
   * A number that indicates the error type that occurred.
   * This MUST be an integer.
   */
  public readonly code: JsonRpcErrorCode

  /**
   * A string providing a short description of the error.
   * The message SHOULD be limited to a concise single sentence.
   */
  public readonly message: string

  /**
   * A primitive or structured value that contains additional information about the error.
   * This may be omitted.
   * The value of this member is defined by the Server (e.g. detailed error information,
   * nested errors etc.).
   */
  public readonly data?: any

  public constructor(code: number, message: string, data?: any) {
    this.code = code
    this.message = message
    this.data = data
  }

  /**
   * Translate a `JsonRpcError` into other application
   * specific errors.
   */
  static toError(error: JsonRpcError): Error {
    const { code, message } = error
    switch (code) {
      case JsonRpcErrorCode.CapabilityError:
        return new CapabilityError(message)
      default:
        return error
    }
  }
}
