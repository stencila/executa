type Interval = NodeJS.Timeout
declare module 'length-prefixed-stream' {
  import stream from 'stream'

  export type Encoder = stream.Transform
  export type Decoder = stream.Transform

  export function encode(): Encoder
  export function decode(): Decoder
}
