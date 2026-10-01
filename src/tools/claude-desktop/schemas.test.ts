import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { AccessLevel, Config } from '../../config/index.js'
import { makeAccessGatedRegister } from '../../utils/access-level.js'
import { memoryFileNameArg, registerClaudeDesktopTools, spaceIdArg } from './index.js'

// These tool-layer schemas are defense-in-depth for inputs that become path
// segments (spaces/<space_id>/memory/<name>). The deep enforcement is the
// two-layer guard in main/, but the schema must reject traversal / separators /
// option-injection-style values before the call ever reaches main/.

describe('spaceIdArg', () => {
  it('accepts a plain identifier', () => {
    expect(spaceIdArg.safeParse('kit-legal_space.1').success).toBe(true)
  })

  it('rejects traversal, separators, "." / "..", and a leading "-"', () => {
    for (const bad of ['..', '.', '../other', 'a/b', 'a\\b', '-flag', '', 'has space', 'tab\tname']) {
      expect(spaceIdArg.safeParse(bad).success).toBe(false)
    }
  })

  it('rejects an over-long id', () => {
    expect(spaceIdArg.safeParse('a'.repeat(256)).success).toBe(false)
  })
})

describe('memoryFileNameArg', () => {
  it('accepts a plain .md file name', () => {
    expect(memoryFileNameArg.safeParse('MEMORY.md').success).toBe(true)
    expect(memoryFileNameArg.safeParse('a_note-1.md').success).toBe(true)
  })

  it('rejects names without .md, with separators, traversal, or a leading "-"', () => {
    for (const bad of ['bad', 'note.txt', '../escape.md', 'a/b.md', 'a\\b.md', '-flag.md', 'foo..md ', '..md', '']) {
      expect(memoryFileNameArg.safeParse(bad).success).toBe(false)
    }
  })

  it('rejects an over-long name', () => {
    expect(memoryFileNameArg.safeParse(`${'a'.repeat(255)}.md`).success).toBe(false)
  })
})

interface RegistrationCall {
  name: string
  config: { inputSchema?: z.ZodType; outputSchema?: z.ZodType; annotations?: Record<string, unknown> }
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

const registerTools = (claudeDesktopRootPath: string, accessLevel?: AccessLevel): RegistrationCall[] => {
  const calls: RegistrationCall[] = []
  const server = {
    registerTool: (name: string, config: RegistrationCall['config'], handler: RegistrationCall['handler']) => {
      calls.push({ name, config, handler })
    }
  } as unknown as McpServer
  const cfg = {
    claudeDesktopRootPath,
    housekeepingPath: path.join(claudeDesktopRootPath, 'housekeeping')
  } as Config
  const registeredServer =
    accessLevel === undefined
      ? server
      : ({
          registerTool: makeAccessGatedRegister(server, accessLevel, {
            mode: 'off',
            path: '/dev/null',
            maxBytes: 0,
            keep: 0
          })
        } as McpServer)
  registerClaudeDesktopTools(registeredServer, cfg)
  return calls
}

describe('Claude Desktop result contracts', () => {
  it('hides both prune tools at read and write, then exposes them at destructive', () => {
    for (const level of ['read', 'write', 'destructive'] as const) {
      const names = registerTools('/tmp/claude-desktop-schema-test', level).map((call) => call.name)
      for (const name of ['claude_desktop_sessions_prune', 'claude_desktop_outputs_prune']) {
        expect(names.includes(name)).toBe(level === 'destructive')
      }
    }
  })

  it('registers a strict output schema for every tool', () => {
    const calls = registerTools('/tmp/claude-desktop-schema-test')

    expect(calls).toHaveLength(22)
    for (const call of calls) expect(call.config.outputSchema).toBeDefined()

    expect(calls.map((call) => call.name)).toContain('claude_desktop_sessions_prune')
    expect(calls.map((call) => call.name)).toContain('claude_desktop_outputs_prune')
    for (const name of ['claude_desktop_sessions_prune', 'claude_desktop_outputs_prune']) {
      const config = calls.find((call) => call.name === name)?.config
      expect(config?.inputSchema?.parse({ older_than_days: 30 })).toMatchObject({ dry_run: true })
      expect(config?.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false })
    }

    const workspaces = calls.find((call) => call.name === 'claude_desktop_workspaces_list')?.config.outputSchema
    const valid = {
      root_path: '/tmp/root',
      workspace_count: 1,
      workspaces: [{ id: 'account/workspace', root: '/tmp/w' }]
    }
    expect(workspaces?.safeParse(valid).success).toBe(true)
    expect(workspaces?.safeParse({ ...valid, unexpected: true }).success).toBe(false)
    expect(
      workspaces?.safeParse({ ...valid, workspaces: [{ ...valid.workspaces[0], unexpected: true }] }).success
    ).toBe(false)
  })

  it('returns schema-valid structured content from a successful handler', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-desktop-tools-'))
    try {
      const workspaceRoot = path.join(root, 'account', 'workspace')
      await fs.mkdir(workspaceRoot, { recursive: true })
      await fs.writeFile(path.join(workspaceRoot, '.claude.json'), '{}\n')
      const calls = registerTools(root)
      const registration = calls.find((call) => call.name === 'claude_desktop_workspaces_list')

      const result = await registration?.handler({})

      expect(result).toMatchObject({
        structuredContent: {
          root_path: root,
          workspace_count: 1,
          workspaces: [{ id: 'account/workspace', root: workspaceRoot }]
        }
      })
      expect(registration?.config.outputSchema?.safeParse(result?.structuredContent).success).toBe(true)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('preserves the MCP error envelope when a handler cannot resolve its workspace', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-desktop-tools-'))
    try {
      const calls = registerTools(root)
      const registration = calls.find((call) => call.name === 'claude_desktop_memory_read')

      const result = await registration?.handler({ space_id: 'space', name: 'note.md', workspace: 'missing' })

      expect(result).toEqual({
        resultType: 'complete',
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Error reading Claude Desktop memory file: Unknown workspace "missing". Available: (none)'
          }
        ]
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('requires explicit workspace selection for either new prune tool when more than one exists', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-desktop-tools-'))
    try {
      for (const id of ['one', 'two']) {
        const workspace = path.join(root, 'account', id)
        await fs.mkdir(workspace, { recursive: true })
        await fs.writeFile(path.join(workspace, '.claude.json'), '{}')
        await fs.writeFile(path.join(workspace, 'local_old.json'), '{}')
      }
      const calls = registerTools(root)
      for (const name of ['claude_desktop_sessions_prune', 'claude_desktop_outputs_prune']) {
        const registration = calls.find((call) => call.name === name)
        const rejected = await registration?.handler({ older_than_days: 30, dry_run: false })
        expect(rejected).toMatchObject({ isError: true })
        expect(rejected?.content).toEqual(
          expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('specify "workspace"') })])
        )
        expect(await fs.readFile(path.join(root, 'account', 'one', 'local_old.json'), 'utf8')).toBe('{}')
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('returns schema-valid non-mutating previews for an explicitly chosen workspace', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-desktop-tools-'))
    try {
      const workspace = path.join(root, 'account', 'one')
      await fs.mkdir(workspace, { recursive: true })
      await fs.writeFile(path.join(workspace, '.claude.json'), '{}')
      const json = path.join(workspace, 'local_old.json')
      await fs.writeFile(json, '{}')
      const aged = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      await fs.utimes(json, aged, aged)
      const calls = registerTools(root)
      for (const name of ['claude_desktop_sessions_prune', 'claude_desktop_outputs_prune']) {
        const registration = calls.find((call) => call.name === name)
        const args = registration?.config.inputSchema?.parse({ older_than_days: 30, workspace: 'account/one' })
        const result = await registration?.handler(args as Record<string, unknown>)
        expect(result).toMatchObject({ structuredContent: { workspace: 'account/one', dry_run: true, removed: [] } })
        expect(registration?.config.outputSchema?.safeParse(result?.structuredContent).success).toBe(true)
      }
      expect(await fs.readFile(json, 'utf8')).toBe('{}')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
