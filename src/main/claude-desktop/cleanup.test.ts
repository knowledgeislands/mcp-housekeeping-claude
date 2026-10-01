import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listObsolete, obsoleteOutputs } from './audit.js'
import { outputsPrune, sessionsPrune } from './cleanup.js'
import * as selection from './selection.js'

const DAY = 24 * 60 * 60 * 1000
const old = new Date(Date.now() - 60 * DAY)
let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ki-cowork-cleanup-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

const session = async (name: string, age: Date = old, sidecar = true) => {
  const json = path.join(root, `${name}.json`)
  await fs.writeFile(json, '{}')
  await fs.utimes(json, age, age)
  if (sidecar) {
    await fs.mkdir(path.join(root, name))
    await fs.utimes(path.join(root, name), age, age)
  }
}

describe('Claude Desktop session pruning', () => {
  it('defaults to preview when dry_run is omitted at the main API', async () => {
    await session('local_old')
    const preview = await sessionsPrune(root, { older_than_days: 30 })
    expect(preview.dry_run).toBe(true)
    expect(preview.removed).toEqual([])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('skips a session that becomes active after selection', async () => {
    await session('local_old')
    const original = selection.selectObsoleteSessions
    vi.spyOn(selection, 'selectObsoleteSessions').mockImplementation(async (workspace, cutoff) => {
      const selected = await original(workspace, cutoff)
      await fs.utimes(path.join(root, 'local_old.json'), new Date(), new Date())
      return selected
    })
    const effect = await sessionsPrune(root, { older_than_days: 30, dry_run: false })
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: 'local_old' }])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('skips a session whose sidecar becomes a symlink after selection', async () => {
    await session('local_old')
    const original = selection.selectObsoleteSessions
    vi.spyOn(selection, 'selectObsoleteSessions').mockImplementation(async (workspace, cutoff) => {
      const selected = await original(workspace, cutoff)
      await fs.rm(path.join(root, 'local_old'), { recursive: true })
      await fs.symlink(root, path.join(root, 'local_old'))
      return selected
    })
    const effect = await sessionsPrune(root, { older_than_days: 30, dry_run: false })
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: 'local_old' }])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('rechecks changed age immediately before removing a sidecar', async () => {
    await session('local_old')
    const original = selection.inspectSession
    let calls = 0
    vi.spyOn(selection, 'inspectSession').mockImplementation(async (workspace, name, cutoff) => {
      calls++
      if (calls === 2) await fs.utimes(path.join(root, 'local_old.json'), new Date(), new Date())
      return original(workspace, name, cutoff)
    })
    const effect = await sessionsPrune(root, { older_than_days: 30, dry_run: false })
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: 'local_old/' }])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('reports a failed directory removal and retains the JSON', async () => {
    await session('local_old')
    const effect = await sessionsPrune(
      root,
      { older_than_days: 30, dry_run: false },
      {
        rm: async () => {
          throw new Error('removal denied')
        },
        unlink: fs.unlink
      }
    )
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: 'local_old/' }])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('reports partial progress if the JSON changes after the sidecar is removed', async () => {
    await session('local_old')
    const effect = await sessionsPrune(
      root,
      { older_than_days: 30, dry_run: false },
      {
        rm: async (target, options) => {
          await fs.rm(target, options)
          await fs.utimes(path.join(root, 'local_old.json'), new Date(), new Date())
        },
        unlink: fs.unlink
      }
    )
    expect(effect.removed).toEqual([{ path: 'local_old/', bytes: expect.any(Number) }])
    expect(effect.skipped).toMatchObject([{ path: 'local_old.json' }])
    expect(effect.partial).toBe(true)
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })

  it('reports a failed JSON unlink without claiming its bytes', async () => {
    await session('local_old', old, false)
    const effect = await sessionsPrune(
      root,
      { older_than_days: 30, dry_run: false },
      {
        rm: fs.rm,
        unlink: async () => {
          throw new Error('removal denied')
        }
      }
    )
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: 'local_old.json' }])
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
  })
  it('uses the complete audit selector beyond the top ten and defaults to a byte-preserving preview', async () => {
    for (let i = 0; i < 12; i++) await session(`local_${i}`)
    await fs.writeFile(path.join(root, 'local_0', 'nested.txt'), 'keep until effect')
    await session('local_young', new Date())
    await session('local_bad name')
    const audit = await listObsolete(root, { older_than_days: 30, flag_count: 999, flag_size_mb: 999 })
    const preview = await sessionsPrune(root, { older_than_days: 30, dry_run: true })
    expect(audit.obsolete_count).toBe(12)
    expect(audit.top_10_oldest).toHaveLength(10)
    expect(preview.candidates).toHaveLength(12)
    expect(preview.candidates.map((candidate) => candidate.session).sort()).toEqual(
      Array.from({ length: 12 }, (_, i) => `local_${i}`).sort()
    )
    expect(preview.candidate_bytes).toBe(audit.total_bytes)
    expect(preview.removed).toEqual([])
    expect(await fs.readFile(path.join(root, 'local_0.json'), 'utf8')).toBe('{}')
    expect(await fs.readFile(path.join(root, 'local_0', 'nested.txt'), 'utf8')).toBe('keep until effect')

    const effect = await sessionsPrune(root, { older_than_days: 30, dry_run: false })
    expect(effect.candidates).toEqual(preview.candidates)
    expect(effect.removed).toHaveLength(24)
    expect(effect.affected_bytes).toBe(effect.candidate_bytes)
    await expect(fs.stat(path.join(root, 'local_0.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.stat(path.join(root, 'local_0'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await fs.readFile(path.join(root, 'local_young.json'), 'utf8')).toBe('{}')
    expect(await fs.readFile(path.join(root, 'local_bad name.json'), 'utf8')).toBe('{}')
  })

  it('uses a strict cutoff and removes a selected JSON without a sidecar', async () => {
    await session('local_edge', old, false)
    const mtime = (await fs.stat(path.join(root, 'local_edge.json'))).mtimeMs
    vi.spyOn(Date, 'now').mockReturnValue(mtime + 30 * DAY)
    expect((await sessionsPrune(root, { older_than_days: 30, dry_run: true })).candidates).toEqual([])
    vi.spyOn(Date, 'now').mockReturnValue(mtime + 30 * DAY + 1)
    const effect = await sessionsPrune(root, { older_than_days: 30, dry_run: false })
    expect(effect.candidates).toHaveLength(1)
    expect(effect.removed).toEqual([{ path: 'local_edge.json', bytes: 2 }])
  })

  it('skips a symlinked sidecar and never touches its external target', async () => {
    await session('local_link', old, false)
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ki-cowork-external-'))
    try {
      await fs.writeFile(path.join(outside, 'private.txt'), 'untouched')
      await fs.symlink(outside, path.join(root, 'local_link'))
      const preview = await sessionsPrune(root, { older_than_days: 30, dry_run: true })
      expect(preview.candidates).toEqual([])
      expect(preview.skipped).toMatchObject([{ path: 'local_link.json' }])
      await sessionsPrune(root, { older_than_days: 30, dry_run: false })
      expect(await fs.readFile(path.join(root, 'local_link.json'), 'utf8')).toBe('{}')
      expect(await fs.readFile(path.join(outside, 'private.txt'), 'utf8')).toBe('untouched')
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})

describe('Claude Desktop output and upload pruning', () => {
  it('defaults to preview and skips a file changed after selection', async () => {
    await session('local_old')
    await fs.mkdir(path.join(root, 'local_old', 'outputs'))
    const file = path.join(root, 'local_old', 'outputs', 'a.txt')
    await fs.writeFile(file, 'before')
    expect((await outputsPrune(root, { older_than_days: 14 })).dry_run).toBe(true)
    const original = selection.selectArtifactSessions
    vi.spyOn(selection, 'selectArtifactSessions').mockImplementation(async (workspace) => {
      const selected = await original(workspace)
      await fs.writeFile(file, 'after')
      return selected
    })
    const effect = await outputsPrune(root, { older_than_days: 14, dry_run: false })
    expect(effect.removed).toEqual([])
    expect(effect.skipped).toMatchObject([{ path: path.join('local_old', 'outputs', 'a.txt') }])
    expect(await fs.readFile(file, 'utf8')).toBe('after')
  })
  it('shares the audit age rule, uses the absent-JSON fallback, and leaves nested files and session metadata', async () => {
    await session('local_old')
    await fs.mkdir(path.join(root, 'local_old', 'outputs', 'nested'), { recursive: true })
    await fs.mkdir(path.join(root, 'local_old', 'uploads'))
    await fs.writeFile(path.join(root, 'local_old', 'outputs', 'a.txt'), 'output')
    await fs.writeFile(path.join(root, 'local_old', 'outputs', 'nested', 'keep.txt'), 'nested')
    await fs.writeFile(path.join(root, 'local_old', 'uploads', 'b.txt'), 'upload')
    await session('local_missing')
    await fs.rm(path.join(root, 'local_missing.json'))
    await fs.mkdir(path.join(root, 'local_missing', 'outputs'))
    await fs.writeFile(path.join(root, 'local_missing', 'outputs', 'c.txt'), 'fallback')
    await fs.utimes(path.join(root, 'local_missing'), old, old)
    await session('local_young', new Date())
    await fs.mkdir(path.join(root, 'local_young', 'outputs'))
    await fs.writeFile(path.join(root, 'local_young', 'outputs', 'keep.txt'), 'young')

    const audit = await obsoleteOutputs(root, { older_than_days: 14 })
    const preview = await outputsPrune(root, { older_than_days: 14, dry_run: true })
    expect(audit.obsolete_count).toBe(2)
    expect(preview.candidates.map((candidate) => candidate.name).sort()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    expect(preview.removed).toEqual([])
    expect(await fs.readFile(path.join(root, 'local_old', 'uploads', 'b.txt'), 'utf8')).toBe('upload')

    const effect = await outputsPrune(root, { older_than_days: 14, dry_run: false })
    expect(effect.removed).toHaveLength(3)
    expect(effect.affected_bytes).toBe(effect.candidate_bytes)
    expect(await fs.readFile(path.join(root, 'local_old', 'outputs', 'nested', 'keep.txt'), 'utf8')).toBe('nested')
    expect(await fs.readFile(path.join(root, 'local_old.json'), 'utf8')).toBe('{}')
    expect(await fs.readFile(path.join(root, 'local_young', 'outputs', 'keep.txt'), 'utf8')).toBe('young')
  })

  it('skips symlinked output roots and direct files without following them', async () => {
    await session('local_old')
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ki-cowork-external-'))
    try {
      await fs.writeFile(path.join(outside, 'private.txt'), 'secret')
      await fs.symlink(outside, path.join(root, 'local_old', 'outputs'))
      await fs.mkdir(path.join(root, 'local_old', 'uploads'))
      await fs.symlink(path.join(outside, 'private.txt'), path.join(root, 'local_old', 'uploads', 'private.txt'))
      const effect = await outputsPrune(root, { older_than_days: 14, dry_run: false })
      expect(effect.candidates).toEqual([])
      expect(effect.skipped.map((item) => item.path).sort()).toEqual(
        [path.join('local_old', 'outputs'), path.join('local_old', 'uploads', 'private.txt')].sort()
      )
      expect(await fs.readFile(path.join(outside, 'private.txt'), 'utf8')).toBe('secret')
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('refuses a symlinked workspace root for both prune modes', async () => {
    const linked = `${root}-link`
    await fs.symlink(root, linked)
    try {
      await expect(sessionsPrune(linked, { older_than_days: 30, dry_run: false })).rejects.toThrow('direct directory')
      await expect(outputsPrune(linked, { older_than_days: 14, dry_run: false })).rejects.toThrow('direct directory')
    } finally {
      await fs.unlink(linked)
    }
  })
})

describe('safe selection details', () => {
  it('sorts multiple direct output files by name', async () => {
    await session('local_sorted')
    await fs.mkdir(path.join(root, 'local_sorted', 'outputs'))
    await fs.writeFile(path.join(root, 'local_sorted', 'outputs', 'z.txt'), 'z')
    await fs.writeFile(path.join(root, 'local_sorted', 'outputs', 'a.txt'), 'a')
    const found = await selection.inspectArtifactSession(root, 'local_sorted')
    expect(found?.session.files.map((file) => file.name)).toEqual(['a.txt', 'z.txt'])
  })
  it('ignores invalid direct names and missing session directories', async () => {
    expect(await selection.inspectSession(root, 'not_local', Date.now())).toBeNull()
    expect(await selection.inspectArtifactSession(root, 'not_local')).toBeNull()
    expect(await selection.inspectArtifactSession(root, 'local_missing')).toBeNull()
    await fs.writeFile(path.join(root, 'local_regular'), 'not a directory')
    expect((await selection.selectArtifactSessions(root)).skipped).toMatchObject([{ path: 'local_regular' }])
  })

  it('skips a symlinked session JSON and a nested symlink in a sidecar', async () => {
    await fs.writeFile(path.join(root, 'target.json'), '{}')
    await fs.symlink(path.join(root, 'target.json'), path.join(root, 'local_link.json'))
    await session('local_nested')
    await fs.writeFile(path.join(root, 'inside.txt'), 'inside')
    await fs.symlink(path.join(root, 'inside.txt'), path.join(root, 'local_nested', 'linked.txt'))
    const selected = await selection.selectObsoleteSessions(root, Date.now() - 30 * DAY)
    expect(selected.candidates).toEqual([])
    expect(selected.skipped.map((item) => item.path).sort()).toEqual(['local_link.json', 'local_nested.json'])
  })

  it('skips an artifact session with a symlinked JSON and propagates unreadable directories', async () => {
    await fs.mkdir(path.join(root, 'local_link'))
    await fs.writeFile(path.join(root, 'target.json'), '{}')
    await fs.symlink(path.join(root, 'target.json'), path.join(root, 'local_link.json'))
    expect((await selection.selectArtifactSessions(root)).skipped).toMatchObject([{ path: 'local_link' }])

    await session('local_blocked')
    await fs.mkdir(path.join(root, 'local_blocked', 'outputs'))
    await fs.chmod(path.join(root, 'local_blocked', 'outputs'), 0o000)
    try {
      await expect(selection.selectArtifactSessions(root)).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      await fs.chmod(path.join(root, 'local_blocked', 'outputs'), 0o700)
    }
  })

  it('propagates unreadable session entries and a non-ENOENT lstat failure', async () => {
    await session('local_blocked')
    await fs.chmod(path.join(root, 'local_blocked'), 0o000)
    try {
      await expect(selection.selectObsoleteSessions(root, Date.now() - 30 * DAY)).rejects.toMatchObject({
        code: 'EACCES'
      })
    } finally {
      await fs.chmod(path.join(root, 'local_blocked'), 0o700)
    }
    const blocked = path.join(root, 'blocked')
    await fs.mkdir(blocked)
    await fs.chmod(blocked, 0o000)
    try {
      await expect(selection.lstatOrNull(path.join(blocked, 'missing'))).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      await fs.chmod(blocked, 0o700)
    }
  })

  it('rejects a direct file whose parent is not a directory or is missing', async () => {
    await fs.mkdir(path.join(root, 'local_old'))
    await fs.writeFile(path.join(root, 'local_old', 'outputs'), 'not a directory')
    const file = {
      session: 'local_old',
      area: 'outputs' as const,
      name: 'a.txt',
      bytes: 0,
      snapshot: { dev: 0, ino: 0, size: 0, mtimeMs: 0, ctimeMs: 0 }
    }
    expect(await selection.verifyDirectFile(root, file)).toBe(false)
    expect(await selection.verifyDirectFile(root, { ...file, area: 'uploads' })).toBe(false)
  })
})
