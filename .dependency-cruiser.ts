import type { IConfiguration } from 'dependency-cruiser'

/** One or more top-level areas under `src/`, matched as whole directories. */
const areas = (...names: readonly string[]) => `^src/(${names.join('|')})(/|$)`
/** Everything the repository owns; anything else is a dependency. */
const owned = '^src/'
const testFile = '\\.test\\.ts$'
const entrypoints = areas('mcp-server')
/** The modules each `main/<surface>/index.ts` re-exports as its public namespace. */
const mainSurface = 'main/[^/]+/(index|audit|cleanup|memory|report|sessions)\\.ts$'

const config: IConfiguration = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'A cycle is two modules disagreeing about which of them is underneath.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-unresolvable',
      comment: 'Every rule matches resolved paths, so an unresolved import would cross any boundary unseen.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    },
    {
      name: 'config-is-the-floor',
      comment: 'Configuration is a plain value every layer receives; it depends on no implementation that consumes it.',
      severity: 'error',
      from: { path: areas('config') },
      to: { path: owned, pathNot: areas('config') }
    },
    {
      name: 'utils-stay-shared',
      comment:
        "Helpers shared verbatim with sibling MCPs take config primitives, never this server's implementations or tools.",
      severity: 'error',
      from: { path: areas('utils') },
      to: { path: areas('main', 'tools', 'mcp-server') }
    },
    {
      name: 'main-stays-transport-free',
      comment:
        'Implementations in main/ are usable from a script: they never reach the tool layer, the entrypoints or the MCP SDK.',
      severity: 'error',
      from: { path: areas('main') },
      to: { path: `${areas('tools', 'mcp-server')}|(^|/)node_modules/@modelcontextprotocol/` }
    },
    {
      name: 'tools-stay-thin',
      comment:
        'A tool module declares schema and annotations, hands its arguments to a module its main/ surface index re-exports and wraps the result with the shared envelope helpers; internal helpers such as selection.ts and the server wiring in utils stay out of reach.',
      severity: 'error',
      from: { path: areas('tools'), pathNot: testFile },
      to: {
        path: owned,
        pathNot: `^src/(tools/|${mainSurface}|config/index\\.ts$|utils/(annotations|utils)\\.ts$)`
      }
    },

    {
      name: 'entrypoints-are-not-imported',
      comment: 'The MCP server loads configuration and starts the process; nothing else may import it.',
      severity: 'error',
      from: { path: owned, pathNot: entrypoints },
      to: { path: entrypoints }
    },
    {
      name: 'registration-tests-keep-the-tool-seam',
      comment:
        'Registration tests assert schemas, annotations and access gating through the tool modules, with main/ mocked rather than imported.',
      severity: 'error',
      from: { path: `^src/tools/.+${testFile}` },
      to: { path: areas('main', 'mcp-server') }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    // A type-only import crosses a boundary exactly as a value import does.
    tsPreCompilationDeps: true,
    // The MCP SDK and Zod resolve only through subpath exports.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.d.ts', '.json']
    }
  }
}

export default config
