/** Age-scoped Claude Desktop cleanup. Preview and effect share the audit selectors. */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { assertRealPathWithinRoot, resolveWithinRoot } from '../../utils/utils.js'
import {
  DAY_MS,
  inspectArtifactSession,
  inspectSession,
  lstatOrNull,
  type SessionCandidate,
  type Skipped,
  safeRoot,
  sameSnapshot,
  selectArtifactSessions,
  selectObsoleteSessions,
  verifyDirectFile
} from './selection.js'

type PruneArgs = { older_than_days: number; dry_run?: boolean }
type Removed = { path: string; bytes: number }
type RemovalOps = Pick<typeof fs, 'rm' | 'unlink'>

const currentSession = async (root: string, candidate: SessionCandidate, cutoff: number): Promise<boolean> => {
  try {
    await safeRoot(root)
    const current = await inspectSession(root, candidate.name, cutoff)
    return (
      !!current &&
      sameSnapshot(current.json, candidate.json) &&
      ((current.directory === null && candidate.directory === null) ||
        (current.directory !== null &&
          candidate.directory !== null &&
          sameSnapshot(current.directory, candidate.directory))) &&
      current.treeFingerprint === candidate.treeFingerprint
    )
  } catch {
    return false
  }
}

export const sessionsPrune = async (workspaceRoot: string, args: PruneArgs, remove: RemovalOps = fs) => {
  const dryRun = args.dry_run !== false
  const cutoff = Date.now() - args.older_than_days * DAY_MS
  const { candidates: selected, skipped } = await selectObsoleteSessions(workspaceRoot, cutoff)
  const candidates = selected.map((candidate) => ({
    session: candidate.name,
    paths: [`${candidate.name}.json`, ...(candidate.directory ? [`${candidate.name}/`] : [])],
    bytes: candidate.jsonBytes + candidate.dirBytes
  }))
  const removed: Removed[] = []
  const results: Skipped[] = [...skipped]
  if (!dryRun) {
    for (const candidate of selected) {
      if (!(await currentSession(workspaceRoot, candidate, cutoff))) {
        results.push({ path: candidate.name, reason: 'session changed, became active, or is no longer contained' })
        continue
      }
      if (candidate.directory) {
        const directory = resolveWithinRoot(workspaceRoot, candidate.name)
        try {
          await assertRealPathWithinRoot(workspaceRoot, directory)
          if (!(await currentSession(workspaceRoot, candidate, cutoff))) throw new Error('changed before removal')
          await remove.rm(directory, { recursive: true })
          removed.push({ path: `${candidate.name}/`, bytes: candidate.dirBytes })
        } catch {
          results.push({
            path: `${candidate.name}/`,
            reason: 'directory changed or removal failed; session JSON retained'
          })
          continue
        }
      }
      const jsonPath = resolveWithinRoot(workspaceRoot, `${candidate.name}.json`)
      try {
        await assertRealPathWithinRoot(workspaceRoot, jsonPath)
        const stat = await lstatOrNull(jsonPath)
        if (
          !stat?.isFile() ||
          !sameSnapshot(candidate.json, {
            dev: stat.dev,
            ino: stat.ino,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            ctimeMs: stat.ctimeMs
          }) ||
          stat.mtimeMs >= cutoff
        )
          throw new Error('changed before removal')
        await remove.unlink(jsonPath)
        removed.push({ path: `${candidate.name}.json`, bytes: candidate.jsonBytes })
      } catch {
        results.push({ path: `${candidate.name}.json`, reason: 'session JSON changed or removal failed' })
      }
    }
  }
  return {
    older_than_days: args.older_than_days,
    cutoff_date: new Date(cutoff).toISOString(),
    dry_run: dryRun,
    candidates,
    candidate_bytes: candidates.reduce((sum, candidate) => sum + candidate.bytes, 0),
    removed,
    affected_bytes: removed.reduce((sum, entry) => sum + entry.bytes, 0),
    skipped: results,
    partial: removed.length > 0 && results.length > 0
  }
}

export const outputsPrune = async (workspaceRoot: string, args: PruneArgs, remove: RemovalOps = fs) => {
  const dryRun = args.dry_run !== false
  const cutoff = Date.now() - args.older_than_days * DAY_MS
  const { sessions, skipped } = await selectArtifactSessions(workspaceRoot)
  const eligible = sessions.filter((session) => Number.isFinite(session.mtime) && session.mtime < cutoff)
  const candidates = eligible.flatMap((session) =>
    session.files.map((file) => ({
      session: session.name,
      area: file.area,
      name: file.name,
      bytes: file.bytes
    }))
  )
  const removed: Removed[] = []
  const results: Skipped[] = [...skipped]
  if (!dryRun) {
    for (const session of eligible) {
      for (const file of session.files) {
        const relative = path.join(session.name, file.area, file.name)
        try {
          await safeRoot(workspaceRoot)
          const current = await inspectArtifactSession(workspaceRoot, session.name)
          if (
            !current ||
            current.session.mtime >= cutoff ||
            !sameSnapshot(current.session.directory, session.directory) ||
            (current.session.json === null) !== (session.json === null) ||
            (current.session.json && session.json && !sameSnapshot(current.session.json, session.json)) ||
            !current.session.files.some(
              (item) => item.area === file.area && item.name === file.name && sameSnapshot(item.snapshot, file.snapshot)
            ) ||
            !(await verifyDirectFile(workspaceRoot, file))
          )
            throw new Error('changed before removal')
          const absolute = resolveWithinRoot(workspaceRoot, relative)
          await assertRealPathWithinRoot(workspaceRoot, absolute)
          await remove.unlink(absolute)
          removed.push({ path: relative, bytes: file.bytes })
        } catch {
          results.push({ path: relative, reason: 'file or session changed, became active, escaped, or removal failed' })
        }
      }
    }
  }
  return {
    older_than_days: args.older_than_days,
    cutoff_date: new Date(cutoff).toISOString(),
    dry_run: dryRun,
    candidates,
    candidate_bytes: candidates.reduce((sum, candidate) => sum + candidate.bytes, 0),
    removed,
    affected_bytes: removed.reduce((sum, entry) => sum + entry.bytes, 0),
    skipped: results,
    partial: removed.length > 0 && results.length > 0
  }
}
