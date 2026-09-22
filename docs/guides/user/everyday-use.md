# Everyday use

Use this guide once the server is connected and you want to know what is actually accumulating on your machine. Everything here is read-only and works at the default `read` access level: nothing in this guide can change or delete a file.

## What the server can see

Three areas, each with its own tool prefix and its own idea of what "a session" is.

**Claude Desktop and Cowork** (`claude_desktop_*`) covers the local agent-mode sessions tree: sessions with their `outputs/` and `uploads/`, artifacts and their cache files, memory spaces, installed plugins, the project cache, the debug directory, `.claude.json` backups, and the audit reports this server itself writes. It is the only area organised into [workspaces](configuration.md#understand-cowork-workspaces), so its results come back as a `workspaces` array.

**Claude Code** (`claude_code_*`) covers `~/.claude`: one directory per project holding `<uuid>.jsonl` session transcripts and optional sidecar directories, per-project `memory/`, and the global state — `history.jsonl`, `settings.cleanupPeriodDays`, and `.last-cleanup`. Because a project directory encodes the source path it was opened from, the server can tell you which projects are **orphans**: directories whose source path no longer exists on disk.

**VSCode** (`vscode_*`) covers `~/Library/Application Support/Code/User/workspaceStorage`: one entry per workspace, each holding `chatSessions/` with `.json` or `.jsonl` chat transcripts.

## Ask for the shape of things

The useful first question for any area is its summary, because each one returns counts, total bytes, and flags rather than a file listing:

> "Give me a storage summary for all three areas."

That calls `claude_desktop_storage_summary`, `claude_code_storage_summary`, and `vscode_storage_summary`. The flags are threshold-driven and the thresholds are arguments — `claude_code_storage_summary`, for example, flags on total size in GB, session count, and orphan count, with defaults of 2 GB, 500 sessions, and 5 orphans. If a flag fires on your machine constantly, raise the threshold in the request rather than ignoring the result.

From there the questions get specific:

> "Which Claude Code projects are taking the most space, and are any of them orphans?"

`claude_code_projects_list` returns every project with its session count, size on disk, decoded source path, and a `source_exists` flag, sorted by size. This is the question to ask before any cleanup, because it distinguishes a project you renamed (which wants relocating) from one you deleted (which wants pruning).

> "What is older than ninety days across all three areas?"

Each area has an obsolescence check — `claude_desktop_sessions_obsolete`, `claude_code_sessions_obsolete`, `vscode_sessions_obsolete` — taking the age in days and reporting what matches with the space it occupies. Nothing is deleted by asking.

> "Show me artifact health and which sessions still have non-empty outputs."

`claude_desktop_artifacts_health` returns per-artifact metadata with flags for high churn, staleness, and unstarred-and-idle. `claude_desktop_outputs_obsolete` finds sessions old enough to prune that still hold files in `outputs/` or `uploads/` — the check worth running before deciding anything is disposable.

## Read a transcript

`claude_code_session_read` and `vscode_session_read` preview the head and tail of one session file rather than returning the whole thing, which for a long transcript would be unusable in a conversation. Name the project or workspace and the session file; both take identifiers constrained to a single path segment, so a session name must look like `<uuid>.jsonl`.

`claude_code_sessions_discover`, `claude_code_sessions_list`, and `claude_code_sessions_checkpoint` serve a narrower purpose: they return a content-minimised, provenance-preserving checkpoint of the Claude Code sessions belonging to one physical repository, for tooling that acquires session history into a knowledge base. They are read-only like the rest, and they are not the way to read a transcript yourself.

## Review memory before anything touches it

`claude_desktop_memory_spaces_summary` lists each Cowork memory space with its file count and the first lines of its `MEMORY.md`; `claude_desktop_memory_list` and `claude_desktop_memory_read` then show one space's files and their contents. `claude_code_memory_list` and `claude_code_memory_read` do the same for a Claude Code project's `memory/` directory.

Memory is the most expensive thing in any of these directories to lose, because it is written deliberately rather than accumulated. Reading it is free; consolidating it is an operator action, and [Cleaning up state](../operator/cleaning-up-state.md) covers what the server will and will not do to it.

## Where reading stops

Some things that feel like reading are registered as destructive and will not be available at the default access level:

- **Writing a report.** `claude_desktop_report_write` creates or overwrites `cowork-audit-YYYY-MM-DD.md`, and `claude_desktop_reports_clear` deletes the older ones. Asking for the daily audit therefore needs the `destructive` level even though almost all of it is reading — see [The daily audit](../operator/daily-audit.md).
- **Anything that frees space.** Pruning sessions, artifacts, orphaned projects, or VSCode workspaces all delete files permanently.
- **Consolidating memory.** Writing, replacing, or retiring a memory file is destructive by annotation, because it overwrites.

`claude_desktop_reports_list` is read-only, so you can always see which reports exist without raising the access level.

If the model tells you a tool is unavailable rather than refusing the request, that is the access-level gate doing its job: the tool was never registered. [Configuration](configuration.md#choose-an-access-level) explains how to change that deliberately.
