import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'))

export const {name, version, description, author} = packageJson
export default packageJson
