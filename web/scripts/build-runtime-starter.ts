import { createHash } from 'node:crypto'
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

const ALLOWED_FILES = [
  'app.js',
  'index.html',
  'manifest.json',
  'styles.css',
  'vendor/agentstudio-runtime.global.js'
] as const
const FIXED_DATE = new Date('2000-01-01T00:00:00.000Z')

export interface RuntimeStarterBuildResult {
  zipPath: string
  files: string[]
  sdkSha256: string
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function toPosix(value: string) {
  return value.split(sep).join('/')
}

function collectFiles(root: string, current = root): string[] {
  const files: string[] = []
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = resolve(current, entry.name)
    if (lstatSync(absolute).isSymbolicLink()) {
      throw new Error(`Runtime Starter cannot contain symbolic links: ${entry.name}`)
    }
    if (entry.isDirectory()) files.push(...collectFiles(root, absolute))
    if (entry.isFile()) files.push(toPosix(relative(root, absolute)))
  }
  return files.sort()
}

function copyChecked(source: string, target: string) {
  const stats = lstatSync(source)
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Runtime Starter source must be a regular file: ${source}`)
  }
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
}

export async function buildRuntimeStarter(): Promise<RuntimeStarterBuildResult> {
  const webRoot = process.cwd()
  const metadata = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8'))
  if (metadata.name !== 'art-design-pro') {
    throw new Error('Run Runtime Starter build from the web workspace root')
  }

  const sourceRoot = resolve(webRoot, 'examples/runtime-starter')
  const sdkPath = resolve(webRoot, 'packages/app-runtime-sdk/dist/agentstudio-runtime.global.js')
  const artifactRoot = resolve(webRoot, '.artifacts')
  const assemblyRoot = resolve(artifactRoot, `runtime-starter-assembly-${process.pid}`)
  const zipPath = resolve(artifactRoot, 'runtime-starter.zip')
  const pendingZipPath = `${zipPath}.${process.pid}.tmp`

  rmSync(assemblyRoot, { recursive: true, force: true })
  mkdirSync(assemblyRoot, { recursive: true })
  try {
    for (const name of ['app.js', 'index.html', 'manifest.json', 'styles.css']) {
      copyChecked(resolve(sourceRoot, name), resolve(assemblyRoot, name))
    }
    copyChecked(sdkPath, resolve(assemblyRoot, 'vendor/agentstudio-runtime.global.js'))

    const files = collectFiles(assemblyRoot)
    if (files.join('\n') !== ALLOWED_FILES.join('\n')) {
      throw new Error(`Unexpected Runtime Starter files: ${files.join(', ')}`)
    }

    const zip = new JSZip()
    for (const name of files) {
      zip.file(name, readFileSync(resolve(assemblyRoot, ...name.split('/'))), {
        date: FIXED_DATE,
        createFolders: false,
        unixPermissions: 0o100644
      })
    }
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      platform: 'UNIX',
      streamFiles: true
    })
    mkdirSync(artifactRoot, { recursive: true })
    writeFileSync(pendingZipPath, buffer)
    rmSync(zipPath, { force: true })
    renameSync(pendingZipPath, zipPath)

    return {
      zipPath,
      files,
      sdkSha256: sha256(readFileSync(sdkPath))
    }
  } finally {
    rmSync(pendingZipPath, { force: true })
    rmSync(assemblyRoot, { recursive: true, force: true })
  }
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entry === import.meta.url) {
  const result = await buildRuntimeStarter()
  console.log(`Runtime Starter built: ${relative(process.cwd(), result.zipPath)}`)
}
