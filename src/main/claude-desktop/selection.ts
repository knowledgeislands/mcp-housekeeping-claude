/** Shared, complete Claude Desktop session selectors. No operation here deletes state. */
import { createHash } from 'node:crypto'
import type { Stats } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { assertRealPathWithinRoot, duBytes, isNodeError, resolveWithinRoot } from '../../utils/utils.js'

const SESSION_NAME = /^local_[A-Za-z0-9][A-Za-z0-9._-]*$/
export const DAY_MS = 24 * 60 * 60 * 1000

export type Snapshot = { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number }
export type Skipped = { path: string; reason: string }
export type SessionCandidate = {
  name: string
  mtime: number
  json: Snapshot
  directory: Snapshot | null
  treeFingerprint: string | null
  jsonBytes: number
  dirBytes: number
}
export type DirectFile = {
  session: string
  area: 'outputs' | 'uploads'
  name: string
  bytes: number
  snapshot: Snapshot
}
export type ArtifactSession = {
  name: string
  mtime: number
  json: Snapshot | null
  directory: Snapshot
  files: DirectFile[]
}

const snapshot = (stat: Stats): Snapshot => ({
  dev: stat.dev,
  ino: stat.ino,
  size: stat.size,
  mtimeMs: stat.mtimeMs,
  ctimeMs: stat.ctimeMs
})
export const sameSnapshot = (left: Snapshot, right: Snapshot): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

export const lstatOrNull = async (file: string): Promise<Stats | null> => {
  try {
    return await fs.lstat(file)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null
    throw error
  }
}

export const safeRoot = async (root: string): Promise<void> => {
  const stat = await fs.lstat(root)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workspace root must be a direct directory.')
}

const safePath = async (root: string, ...parts: string[]): Promise<string> => {
  const file = resolveWithinRoot(root, path.join(...parts))
  await assertRealPathWithinRoot(root, file)
  return file
}

const treeFingerprint = async (root: string, name: string): Promise<string> => {
  const hash = createHash('sha256')
  const visit = async (relative: string): Promise<void> => {
    const absolute = await safePath(root, relative)
    const stat = await fs.lstat(absolute)
    if (!stat.isDirectory() && !stat.isFile()) throw new Error('Unsupported or symlinked session entry.')
    hash.update(`${relative}\0${JSON.stringify(snapshot(stat))}\n`)
    if (stat.isDirectory()) {
      const entries = (await fs.readdir(absolute)).sort()
      for (const entry of entries) await visit(path.join(relative, entry))
    }
  }
  await visit(name)
  return hash.digest('hex')
}

export const inspectSession = async (root: string, name: string, cutoff: number): Promise<SessionCandidate | null> => {
  if (!SESSION_NAME.test(name)) return null
  const jsonPath = await safePath(root, `${name}.json`)
  const jsonStat = await lstatOrNull(jsonPath)
  if (!jsonStat || !jsonStat.isFile() || jsonStat.mtimeMs >= cutoff || !Number.isFinite(jsonStat.mtimeMs)) return null
  const dirPath = resolveWithinRoot(root, name)
  const dirStat = await lstatOrNull(dirPath)
  if (dirStat && !dirStat.isDirectory()) throw new Error('Session sidecar is not a direct directory.')
  if (dirStat) await assertRealPathWithinRoot(root, dirPath)
  return {
    name,
    mtime: jsonStat.mtimeMs,
    json: snapshot(jsonStat),
    directory: dirStat ? snapshot(dirStat) : null,
    treeFingerprint: dirStat ? await treeFingerprint(root, name) : null,
    jsonBytes: jsonStat.size,
    dirBytes: dirStat ? await duBytes(dirPath) : 0
  }
}

export const selectObsoleteSessions = async (root: string, cutoff: number) => {
  await safeRoot(root)
  const candidates: SessionCandidate[] = []
  const skipped: Skipped[] = []
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue
    const name = entry.name.slice(0, -5)
    if (!SESSION_NAME.test(name)) continue
    if (!entry.isFile()) {
      skipped.push({ path: entry.name, reason: 'not a direct regular session JSON' })
      continue
    }
    try {
      const candidate = await inspectSession(root, name, cutoff)
      if (candidate) candidates.push(candidate)
    } catch (error) {
      if (isNodeError(error) && error.code === 'EACCES') throw error
      skipped.push({ path: entry.name, reason: 'unreadable, changed, symlinked, or unsupported session' })
    }
  }
  candidates.sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name))
  return { candidates, skipped }
}

const listDirectFiles = async (root: string, session: string, area: 'outputs' | 'uploads') => {
  const relative = path.join(session, area)
  const directory = resolveWithinRoot(root, relative)
  const stat = await lstatOrNull(directory)
  if (!stat) return { files: [] as DirectFile[], skipped: [] as Skipped[] }
  if (!stat.isDirectory())
    return { files: [] as DirectFile[], skipped: [{ path: relative, reason: 'not a direct directory' }] }
  await assertRealPathWithinRoot(root, directory)
  const files: DirectFile[] = []
  const skipped: Skipped[] = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fileRelative = path.join(relative, entry.name)
    if (entry.isDirectory()) continue // Nested files are deliberately out of scope.
    if (!entry.isFile()) {
      skipped.push({ path: fileRelative, reason: 'not a direct regular file' })
      continue
    }
    try {
      const file = await safePath(root, fileRelative)
      const fileStat = await fs.lstat(file)
      /* v8 ignore start -- readdir saw a regular file; a changed type here requires a concurrent filesystem replacement. Effect revalidation covers changed candidates. */
      if (!fileStat.isFile()) throw new Error('changed file type')
      /* v8 ignore stop */
      files.push({ session, area, name: entry.name, bytes: fileStat.size, snapshot: snapshot(fileStat) })
      /* v8 ignore start -- the guarded file can only disappear or escape after readdir in a concurrent filesystem race. */
    } catch {
      skipped.push({ path: fileRelative, reason: 'unreadable, changed, or escaping file' })
      /* v8 ignore stop */
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name))
  return { files, skipped }
}

export const inspectArtifactSession = async (
  root: string,
  name: string
): Promise<{ session: ArtifactSession; skipped: Skipped[] } | null> => {
  if (!SESSION_NAME.test(name)) return null
  const dirPath = await safePath(root, name)
  const dirStat = await lstatOrNull(dirPath)
  if (!dirStat?.isDirectory()) return null
  const jsonPath = resolveWithinRoot(root, `${name}.json`)
  const jsonStat = await lstatOrNull(jsonPath)
  if (jsonStat && !jsonStat.isFile()) throw new Error('Session JSON is not a direct regular file.')
  if (jsonStat) await assertRealPathWithinRoot(root, jsonPath)
  const outputs = await listDirectFiles(root, name, 'outputs')
  const uploads = await listDirectFiles(root, name, 'uploads')
  return {
    session: {
      name,
      mtime: jsonStat ? jsonStat.mtimeMs : dirStat.mtimeMs,
      json: jsonStat ? snapshot(jsonStat) : null,
      directory: snapshot(dirStat),
      files: [...outputs.files, ...uploads.files]
    },
    skipped: [...outputs.skipped, ...uploads.skipped]
  }
}

export const selectArtifactSessions = async (root: string) => {
  await safeRoot(root)
  const sessions: ArtifactSession[] = []
  const skipped: Skipped[] = []
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!SESSION_NAME.test(entry.name) || entry.name.endsWith('.json')) continue
    if (!entry.isDirectory()) {
      skipped.push({ path: entry.name, reason: 'not a direct session directory' })
      continue
    }
    try {
      const found = await inspectArtifactSession(root, entry.name)
      /* v8 ignore next -- a directory reported by readdir can disappear before lstat only during a concurrent filesystem race. */
      if (found) {
        sessions.push(found.session)
        skipped.push(...found.skipped)
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'EACCES') throw error
      skipped.push({ path: entry.name, reason: 'unreadable, changed, symlinked, or unsupported session' })
    }
  }
  sessions.sort((a, b) => a.name.localeCompare(b.name))
  return { sessions, skipped }
}

export const verifyDirectFile = async (root: string, file: DirectFile): Promise<boolean> => {
  try {
    const directory = await safePath(root, file.session, file.area)
    if (!(await fs.lstat(directory)).isDirectory()) return false
    const target = await safePath(root, file.session, file.area, file.name)
    const current = await fs.lstat(target)
    return current.isFile() && sameSnapshot(file.snapshot, snapshot(current))
  } catch {
    return false
  }
}
