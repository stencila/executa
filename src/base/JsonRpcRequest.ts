import { JsonRpcError, JsonRpcErrorCode } from './JsonRpcError'

/**
 * A JSON-RPC 2.0 request
 *
 * @see {@link https://www.jsonrpc.org/specification#request_object}
 */
export class JsonRpcRequest {
  /**
   * A string specifying the version of the JSON-RPC protocol. MUST be exactly "2.0".
   */
  public readonly jsonrpc: string = '2.0'

  /**
   * An identifier established by the Client that MUST contain a string, number, or
   * NULL value if included. If it is not included it is assumed to be a notification.
   * The value SHOULD normally not be Null and numbers SHOULD NOT contain fractional
   * parts. The Server MUST reply with the same value in the Response object if included.
   * This member is used to correlate the context between the two objects.
   */
  public readonly id?: number

  /**
   * A string containing the name of the method to be invoked.
   * Method names that begin with the word rpc followed by a period character
   * (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions and
   * MUST NOT be used for anything else.
   */
  public readonly method: string

  /**
   * A structured value that holds the parameter values to be used during the
   * invocation of the method.This member MAY be omitted.
   */
  public readonly params?: { [key: string]: any }

  /**
   * A counter for generating unique, sequential request ids.
   *
   * Request ids don't need to be sequential but this helps with debugging.
   * Request ids don't need to be unique across clients.
   */
  private static counter = 0

  /**
   * Create a JSON-RPC request
   *
   * @param method The name of the method to call
   * @param params Values for the methods parameters (i.e. arguments)
   * @param id The request id. If `false`, then the request is a
   *           notification (i.e. no response expected). If
   *           `undefined` then a new id will be generated.
   */
  public constructor(
    method: string,
    params?: { [key: string]: any } | any[],
    id?: number | false
  ) {
    if (id !== undefined && id !== false) {
      this.id = id
    } else if (id === undefined) {
      JsonRpcRequest.counter += 1
      this.id = JsonRpcRequest.counter
    }
    this.method = method
    this.params = params
  }

  public static create(source: unknown): JsonRpcRequest {
    if (typeof source === 'string') return JsonRpcRequest.parse(source)

    if (source !== null && typeof source === 'object' && !Array.isArray(source))
      // @ts-ignore TS doesn't know this is now not a null
      return JsonRpcRequest.hydrate(source)

    throw new JsonRpcError(
      JsonRpcErrorCode.InvalidRequest,
      `Invalid request type: ${typeof source}`
    )
  }

  /**
   * Hydrate a Javascript object into an instance
   *
   * @param obj A plain object representing a request
   */
  public static hydrate(obj: { [key: string]: unknown }): JsonRpcRequest {
    const { method, params, id } = obj
    if (method === undefined)
      throw new JsonRpcError(
        JsonRpcErrorCode.InvalidRequest,
        'Invalid request: missing property: "method"'
      )
    if (typeof method !== 'string')
      throw new JsonRpcError(
        JsonRpcErrorCode.InvalidRequest,
        `Invalid request: incorrect type for "method": ${typeof method}`
      )
    // TODO: Add checking of types of params and id
    // @ts-ignore possibly incorrect argument types
    return new JsonRpcRequest(method, params, id === undefined ? false : id)
  }

  /**
   * Parse a JSON into an instance
   *
   * @param json The JSON representation of the request
   */
  public static parse(json: string): JsonRpcRequest {
    let obj
    try {
      obj = JSON.parse(json)
    } catch (err) {
      throw new JsonRpcError(
        JsonRpcErrorCode.ParseError,
        `Parse error: ${err.message}`
      )
    }
    return JsonRpcRequest.hydrate(obj)
  }
}
