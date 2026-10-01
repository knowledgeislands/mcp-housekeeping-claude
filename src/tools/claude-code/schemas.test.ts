import { describe, expect, it } from 'vitest'
import { ccProjectsListOutput, memoryFileNameArg } from './index.js'

// Defense-in-depth schema for a memory file name that becomes a path segment
// under ~/.claude/projects/<project>/memory/<name>. Mirrors projectArg.

describe('claude-code memoryFileNameArg', () => {
  it('accepts a plain .md file name', () => {
    expect(memoryFileNameArg.safeParse('MEMORY.md').success).toBe(true)
    expect(memoryFileNameArg.safeParse('session-digest_1.md').success).toBe(true)
  })

  it('rejects names without .md, with separators, traversal, or a leading "-"', () => {
    for (const bad of ['bad', 'note.txt', '../escape.md', 'a/b.md', 'a\\b.md', '-flag.md', '..md', '']) {
      expect(memoryFileNameArg.safeParse(bad).success).toBe(false)
    }
  })

  it('rejects an over-long name', () => {
    expect(memoryFileNameArg.safeParse(`${'a'.repeat(255)}.md`).success).toBe(false)
  })
})

describe('claude-code project source output', () => {
  const project = {
    id: '-tmp-project',
    decoded_path: '/tmp/project',
    source_exists: null,
    source_status: 'unverifiable',
    source_path: null,
    source_reason: 'missing_cwd',
    source_provenance: { session_files_examined: 1, cwd_records: 0 },
    session_count: 1,
    has_memory: false,
    bytes: 100
  }

  it('accepts nullable compatibility and explicit uncertainty fields', () => {
    expect(
      ccProjectsListOutput.safeParse({ projects_dir: '/tmp/projects', project_count: 1, projects: [project] }).success
    ).toBe(true)
  })

  it('rejects a false compatibility value for unknown evidence', () => {
    const result = ccProjectsListOutput.safeParse({
      projects_dir: '/tmp/projects',
      project_count: 1,
      projects: [{ ...project, source_exists: false, source_status: 'unknown' }]
    })
    expect(result.success).toBe(false)
  })
})
