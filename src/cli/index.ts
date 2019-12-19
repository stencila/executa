import { main } from './main'

export { main }
export { init } from './init'
export { convert } from './convert'
export { compile } from './compile'
export { query } from './query'
export { execute } from './execute'

// If this is the main mdule then run the main function
if (require.main === module) main().catch(err => console.error(err))
