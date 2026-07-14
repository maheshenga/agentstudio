import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const distRoot = resolve(process.cwd(), 'dist')
const limits = {
  largestJavaScriptBytes: 1_500_000,
  totalJavaScriptBytes: 8_000_000,
  totalCssBytes: 1_500_000
}

if (!existsSync(distRoot)) {
  throw new Error('Build output is missing; run vite build before checking the asset budget')
}

const files = collectFiles(distRoot).filter((path) => !path.endsWith('.gz'))
const javascript = files.filter((path) => ['.js', '.mjs'].includes(extname(path)))
const css = files.filter((path) => extname(path) === '.css')
const javascriptSizes = javascript.map((path) => ({ path, bytes: statSync(path).size }))
const largestJavaScript = javascriptSizes.sort((left, right) => right.bytes - left.bytes)[0]
const totalJavaScriptBytes = javascriptSizes.reduce((total, item) => total + item.bytes, 0)
const totalCssBytes = css.reduce((total, path) => total + statSync(path).size, 0)
const failures: string[] = []

if ((largestJavaScript?.bytes || 0) > limits.largestJavaScriptBytes) {
  failures.push(
    `largest JavaScript asset ${relative(distRoot, largestJavaScript.path)} is ${largestJavaScript.bytes} bytes (limit ${limits.largestJavaScriptBytes})`
  )
}
if (totalJavaScriptBytes > limits.totalJavaScriptBytes) {
  failures.push(
    `total JavaScript is ${totalJavaScriptBytes} bytes (limit ${limits.totalJavaScriptBytes})`
  )
}
if (totalCssBytes > limits.totalCssBytes) {
  failures.push(`total CSS is ${totalCssBytes} bytes (limit ${limits.totalCssBytes})`)
}

if (failures.length) {
  throw new Error(`Build asset budget exceeded:\n${failures.join('\n')}`)
}

console.log(
  `Build asset budget verified: JS ${totalJavaScriptBytes} bytes, CSS ${totalCssBytes} bytes, largest JS ${largestJavaScript?.bytes || 0} bytes.`
)

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? collectFiles(path) : [path]
  })
}
