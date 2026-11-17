import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { isNodeError, pathExists } from '../../utils/utils.js'

const REPORT_PATTERN = /^cowork-audit-.*\.md$/

export const reportList = async (housekeepingPath: string) => {
  let entries: string[]
  try {
    entries = await fs.readdir(housekeepingPath)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return { housekeeping_dir: housekeepingPath, exists: false, reports: [] }
    }
    throw err
  }
  const matches = entries.filter((e) => REPORT_PATTERN.test(e))
  const reports = await Promise.all(
    matches.map(async (name) => {
      const stat = await fs.stat(path.join(housekeepingPath, name))
      return { name, bytes: stat.size, modified: stat.mtime.toISOString() }
    })
  )
  reports.sort((a, b) => b.modified.localeCompare(a.modified))
  return { housekeeping_dir: housekeepingPath, exists: true, reports }
}

export const reportClean = async (housekeepingPath: string, args: { dry_run: boolean }) => {
  let entries: string[]
  try {
    entries = await fs.readdir(housekeepingPath)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return {
        housekeeping_dir: housekeepingPath,
        deleted: [],
        dry_run: args.dry_run,
        note: 'Housekeeping directory does not yet exist; nothing to clean.'
      }
    }
    throw err
  }
  const matches = entries.filter((e) => REPORT_PATTERN.test(e))
  // dry_run previews the would-be deletions without unlinking — matching the
  // repo's other mutating tools, which default dry_run to true.
  if (args.dry_run) {
    return { housekeeping_dir: housekeepingPath, deleted: matches, dry_run: true }
  }
  for (const name of matches) {
    await fs.unlink(path.join(housekeepingPath, name))
  }
  return { housekeeping_dir: housekeepingPath, deleted: matches, dry_run: false }
}

export const reportWrite = async (
  housekeepingPath: string,
  args: { content: string; date?: string; dry_run: boolean }
) => {
  const date = args.date ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date "${date}" — expected YYYY-MM-DD`)
  }
  const filename = `cowork-audit-${date}.md`
  const fullPath = path.join(housekeepingPath, filename)
  const existed = await pathExists(fullPath)
  const bytes = Buffer.byteLength(args.content, 'utf-8')
  // A dry run reports the target, with no mkdir and no write.
  if (args.dry_run) return { path: fullPath, bytes, filename, dry_run: true, written: false, existed }
  await fs.mkdir(housekeepingPath, { recursive: true })
  await fs.writeFile(fullPath, args.content, 'utf-8')
  return { path: fullPath, bytes, filename, dry_run: false, written: true, existed }
}
