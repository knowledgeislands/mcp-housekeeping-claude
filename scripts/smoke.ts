#!/usr/bin/env node
// End-to-end smoke test: boot the built server over stdio MCP, list its tools,
// and assert the surface matches what the registration tests expect. Catches
// drift between code and the *wire* contract (registration tests cover the
// in-process registration call pattern; this covers the actual protocol round-trip).
//
// Run via `bun run test:smoke` (builds dist/ first). Runs in CI without real
// secrets: the server only needs MCP_HOUSEKEEPING_CLAUDE_PATH to point at an
// existing dir, so we hand it the OS temp dir and crank the access level up to
// `destructive` so every gated tool shows up.
//
// This is also the repository's protocol boundary. The MCP 2026-07-28 standard
// puts `server/discover`, protocol stamping, and cache defaults inside the SDK,
// so nothing in src/ can be inspected to prove them — only a live round trip
// can. What is asserted here: the modern era is selected, the negotiated
// version is 2026-07-28, discovery returns a complete result naming this
// server, the tool surface is unchanged, a real call returns a valid envelope,
// a malformed call is rejected, and the deliberate legacy fallback still serves
// an identical surface.

import { tmpdir } from 'node:os'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

// Single source of truth for the tool surface — kept in sync with the
// per-group registration tests. If you add a tool, update both.
const EXPECTED_TOOLS = [
  // claude-code
  'claude_code_projects_list',
  'claude_code_storage_summary',
  'claude_code_sessions_obsolete',
  'claude_code_sessions_checkpoint',
  'claude_code_sessions_discover',
  'claude_code_sessions_list',
  'claude_code_global_status',
  'claude_code_session_read',
  'claude_code_memory_list',
  'claude_code_memory_read',
  'claude_code_sessions_prune',
  'claude_code_project_relocate',
  'claude_code_orphan_projects_prune',
  'claude_code_memory_write',
  'claude_code_memory_delete',
  'claude_code_memory_index_write',
  // claude-desktop
  'claude_desktop_storage_summary',
  'claude_desktop_sessions_obsolete',
  'claude_desktop_artifacts_health',
  'claude_desktop_outputs_obsolete',
  'claude_desktop_backups_summary',
  'claude_desktop_memory_spaces_summary',
  'claude_desktop_plugins_inventory',
  'claude_desktop_project_cache_status',
  'claude_desktop_debug_info',
  'claude_desktop_workspaces_list',
  'claude_desktop_memory_list',
  'claude_desktop_memory_read',
  'claude_desktop_reports_list',
  'claude_desktop_artifacts_prune',
  'claude_desktop_reports_clear',
  'claude_desktop_report_write',
  'claude_desktop_memory_write',
  'claude_desktop_memory_delete',
  'claude_desktop_memory_index_write',
  'claude_desktop_session_rename',
  // vscode
  'vscode_workspaces_list',
  'vscode_storage_summary',
  'vscode_sessions_obsolete',
  'vscode_session_read',
  'vscode_workspace_delete',
  'vscode_sessions_prune'
] as const

const die = (msg: string, detail?: unknown): never => {
  console.error(`✗ smoke failed: ${msg}`)
  if (detail !== undefined) console.error(detail)
  process.exit(1)
}

// Raise the access level to `destructive` so the smoke test sees the full
// surface; the server's default (read only) would otherwise hide every
// mutating tool. Point the required HOUSEKEEPING_PATH at the OS temp dir so
// config validation passes without touching real Claude data.
const createTransport = (): StdioClientTransport =>
  new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp-server/index.js'],
    env: {
      ...(process.env as Record<string, string>),
      MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL: 'destructive',
      MCP_HOUSEKEEPING_CLAUDE_PATH: tmpdir(),
      MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG: 'off'
    }
  })

const main = async (): Promise<void> => {
  const client = new Client(
    { name: 'mcp-housekeeping-claude-smoke', version: '0.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } }
  )

  await client.connect(createTransport())

  try {
    const discovery = client.getDiscoverResult()
    if (client.getProtocolEra() !== 'modern') die('server/discover did not select the modern protocol era')
    if (client.getNegotiatedProtocolVersion() !== '2026-07-28') {
      die('unexpected negotiated protocol version', client.getNegotiatedProtocolVersion())
    }
    if (
      discovery?.resultType !== 'complete' ||
      !discovery.supportedVersions.includes('2026-07-28') ||
      discovery._meta?.['io.modelcontextprotocol/serverInfo']?.name !== 'mcp-housekeeping-claude'
    ) {
      die('invalid server/discover result', discovery)
    }

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    const expected = [...EXPECTED_TOOLS].sort()

    // Diff with clear messages so CI logs are actionable.
    const missing = expected.filter((n) => !names.includes(n))
    const extra = names.filter((n) => !expected.includes(n as (typeof EXPECTED_TOOLS)[number]))
    if (missing.length || extra.length) {
      die('tool surface mismatch', { missing, extra, actualCount: names.length, expectedCount: expected.length })
    }

    // Sanity: every tool advertises an inputSchema object.
    const missingSchema = tools.filter((t) => !t.inputSchema || typeof t.inputSchema !== 'object').map((t) => t.name)
    if (missingSchema.length) die('tools missing inputSchema', missingSchema)

    // A real read-only call against the temp-dir report root. The v2 client
    // validates the required wire-level `resultType` before returning, then
    // lifts a complete result into the stable callTool shape without the
    // discriminator — so reaching here at all proves the envelope was valid.
    const reports = await client.callTool({ name: 'claude_desktop_reports_list', arguments: {} })
    if (reports.isError) die('tool call returned an error envelope', reports)

    // The same tool with an argument its strict schema forbids must be
    // rejected rather than silently accepted.
    const malformed = await client.callTool({
      name: 'claude_desktop_reports_list',
      arguments: { not_a_real_argument: 1 }
    })
    if (!malformed.isError) die('malformed tool arguments were accepted', malformed)

    // The server keeps a deliberate legacy fallback (`legacy: 'serve'`) for
    // clients that have not migrated. A client that does not negotiate must
    // still land on the legacy era and see the identical tool surface.
    const legacyClient = new Client({ name: 'mcp-housekeeping-claude-legacy-smoke', version: '0.0.0' }, {
      capabilities: {}
    })
    await legacyClient.connect(createTransport())
    try {
      if (legacyClient.getProtocolEra() !== 'legacy') {
        die('legacy initialize fallback did not remain available', legacyClient.getProtocolEra())
      }
      if ((await legacyClient.listTools()).tools.length !== EXPECTED_TOOLS.length) {
        die('legacy tool surface differs from modern tool surface')
      }
    } finally {
      await legacyClient.close()
    }

    console.error(`✓ smoke passed: modern discovery, legacy fallback, ${names.length} tools, valid result envelope`)
  } finally {
    await client.close()
  }
}

main().catch((err) => die('uncaught', err))
