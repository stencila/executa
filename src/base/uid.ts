import generate from 'nanoid/generate'

/**
 * Generate a unique id.
 *
 * Generates an id of 22 characters using Roman digits + lowercase and uppercase letters
 * (i.e. is URL safe and excludes the characters like hyphen or underscore).
 * This makes the ids a little more readable than those from the default `nanoid` settings
 * while still having an extremely low collision probability on par with UUID v4.
 *
 * @see {@link https://zelark.github.io/nano-id-cc/|Nano ID Collision Calculator}
 */
export function uid(): string {
  return generate(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    22
  )
}
