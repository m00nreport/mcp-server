# @m00nsolutions/mcp-server

[![npm](https://img.shields.io/npm/v/@m00nsolutions/mcp-server.svg)](https://www.npmjs.com/package/@m00nsolutions/mcp-server)
[![CI](https://github.com/m00nreport/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/m00nreport/mcp-server/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@m00nsolutions/mcp-server.svg)](https://www.npmjs.com/package/@m00nsolutions/mcp-server)
[![license](https://img.shields.io/npm/l/@m00nsolutions/mcp-server.svg)](https://github.com/m00nreport/mcp-server/blob/main/LICENSE)

Agentic test management over MCP. This server lets an AI assistant do the work rather than read about it: author test cases, plan and populate manual test executions, link automation back to the cases it covers, cut releases and read project health in [M00N Report](https://m00nreport.com), an AI-native test management platform.

[![m00nreport/mcp-server MCP server](https://glama.ai/mcp/servers/m00nreport/mcp-server/badges/card.svg)](https://glama.ai/mcp/servers/m00nreport/mcp-server)

## Which Install Do I Need?

| | This npm package (stdio) | Hosted remote connector |
|---|---|---|
| How it runs | `npx @m00nsolutions/mcp-server` as a local process | No local process; the client talks to the API over HTTP |
| Auth | An MCP key in `M00N_API_KEY` | OAuth 2.1 with PKCE, browser consent screen |
| Clients | Any MCP client: Claude Code, Claude Desktop, Cursor, and others | **claude.ai and claude.com only** |

If you are not connecting from claude.ai or claude.com, use this package with an MCP key. That is the rest of this README. For the connector, see the [connector guide](https://m00nreport.com/documentation/mcp/connector).

## Requirements

Node 20 or newer, and any MCP-capable client.

## Installation

No install step. The client launches it with `npx`, as configured below.

To pin a version in a shared or CI environment, append one to the package name in `args`, like `["-y", "@m00nsolutions/mcp-server@<version>"]`. `npm view @m00nsolutions/mcp-server versions` lists what is published. A placeholder rather than a number on purpose: a concrete example here goes stale on the next release, and a stale one recommends pinning to a version that no longer has the current fixes.

## Quick Start

### 1. Get an MCP key

In M00N Report, open **Settings -> MCP Keys** and create a key. It starts with `m00n_mcp_` followed by 48 hex characters. This is not the credential the test reporters use; theirs starts with `m00n_` and is refused here.

An MCP key carries exactly the permissions of the account it belongs to, never more, and can be scoped down further. Scoping removes tools from the list the client sees, so a shorter tool list than you expected is a scoping decision, not a fault.

The key goes in your own MCP client config on your machine. Do not put it in a workspace file that lives in a repository.

### 2. Connect your client

Claude Code, one line:

```bash
claude mcp add m00n --env M00N_API_URL=https://m00nreport.com --env M00N_API_KEY=m00n_mcp_... -- npx -y @m00nsolutions/mcp-server
```

Every other client takes the same JSON block:

```json
{
  "mcpServers": {
    "m00n": {
      "command": "npx",
      "args": ["-y", "@m00nsolutions/mcp-server"],
      "env": {
        "M00N_API_URL": "https://m00nreport.com",
        "M00N_API_KEY": "m00n_mcp_your_key_here"
      }
    }
  }
}
```

Where that block goes:

| Client | Config file |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop, macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop, Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

For a self-hosted instance, point `M00N_API_URL` at your own root origin, with no `/api` suffix. A trailing slash is stripped for you.

### 3. Confirm the connection

Restart the client, then ask it:

> List my M00N Report projects

A list of your projects means the server is connected and the key is valid. An error, or the assistant saying it has no such tool, means it is not; see [Troubleshooting](#troubleshooting).

## Tools

Eight areas. The full list with arguments is at [/documentation/mcp/tools](https://m00nreport.com/documentation/mcp/tools), kept beside the code. The server fetches its own list from your instance at startup, so what your client sees is what your instance supported when the client connected.

| Area | What it covers |
|---|---|
| Projects and analytics | Projects, launch trends and statistics, per-test history, search across automated tests |
| Test cases | Create, read, update, move, delete, bulk edit, and link an automated test to the case it covers |
| Folders and suites | The folder and suite hierarchy, plus per-folder statistics |
| Test collections | Reusable named case sets that drop into any execution |
| Manual executions | Build an execution from suites, collections or individual cases, then record per-case results |
| Releases | Create and manage releases, and attach or detach the launches that belong to them |
| Health and coverage | A composite health check, coverage gaps in both directions, case suggestions, feature scan, report export |
| External links | Attach and remove Jira or Linear tickets on a case |

An execution is a manual test run: assignees, environment, dates, and per-step results captured against a snapshot of each case at the moment it was added.

How many tools your key can see comes from your instance:

```bash
curl -s -H "X-MCP-Key: $M00N_API_KEY" "$M00N_API_URL/api/mcp/tools" | jq .count
```

A scoped key sees fewer. No number is quoted here on purpose: the surface changes with the
release, and a figure in a README is the one place nobody remembers to update.

## Prompts

Guided multi-step workflows the client can offer by name. Each takes a single optional `project` argument, a name or a UUID; omit it and the server picks the project when only one is in scope.

| Prompt | What it does |
|---|---|
| `analyze_flaky_tests` | Find tests that pass and fail without a code change, and rank them |
| `debug_test_failure` | Work a single failure back to a cause from its history and traces |
| `release_readiness` | Judge whether a release is safe to ship |
| `generate_test_cases` | Draft manual cases for an area that has none |
| `weekly_health_report` | Summarise the week across projects |
| `investigate_regression` | Find what changed between a passing and a failing run |
| `run_manual_execution` | Take a manual test cycle from assembly to per-case results |

## Resources

Read-only views the client can pull without calling a tool: all projects, project health summary, flaky tests report, currently failing tests, folder structure, launch report, test case content, release summary.

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `M00N_API_URL` | to connect | | Your M00N Report URL. Root origin, no `/api` suffix. A trailing slash is stripped for you. |
| `M00N_API_KEY` | to connect | | An MCP key (`m00n_mcp_...`). Anything without that prefix is refused before the first request. |
| `M00N_DEBUG` | no | `false` | Adds per-request detail to stderr, including each tool call's arguments. Startup steps and errors are logged either way. |
| `M00N_TIMEOUT_MS` | no | `30000` | Request timeout, a bare number of milliseconds. `60s`, `1e4`, `30,000` and `1.5` are rejected with a warning on stderr and the default is used instead. |
| `M00N_INSECURE_SSL` | no | `false` | Accept a self-signed certificate. Self-hosted instances only. |

The two booleans are on for `true`, `1` or `yes`, in any case. Every other value, `false` and `0` included, leaves them off.

Set both of the first two or neither. Setting one is treated as a mistake and refused, because a
half-configured server that starts anyway is harder to diagnose than one that does not.

The base URL is `M00N_API_URL` here; the test reporters call the same URL `M00N_SERVER_URL`. All six packages read `M00N_API_KEY`, but theirs is a project API key rather than an MCP key, so one exported shell variable cannot serve both.

## Running Without a Key

Started with neither `M00N_API_URL` nor `M00N_API_KEY`, the server runs in preview mode: it lists
its tools, prompts and resources from a bundled snapshot and refuses every call with a message
saying what to set. Nothing is sent anywhere, because there is nowhere to send it.

That is what lets an inspector, a client or a directory show the tool surface before anyone has
signed up. It is a description of the server, never a working one, so the listings come from the
snapshot rather than from your instance: a scoped key normally sees fewer tools than the snapshot
shows.

Maintainers refresh the snapshot with `npm run snapshot:refresh` against an unscoped key.

## Self-Hosted

Point `M00N_API_URL` at your own instance and issue the MCP key from that instance. Everything else is identical, which matters when the reason you self-host is that test data cannot leave your network.

With a self-signed certificate, add `"M00N_INSECURE_SSL": "true"` to the same `env` block. Full notes: [/documentation/mcp/self-hosted](https://m00nreport.com/documentation/mcp/self-hosted).

## What Gets Sent

To `M00N_API_URL` over HTTPS: the tool calls your assistant makes and their arguments. The server is a proxy to your own instance and stores nothing itself.

Every tool call is written to an MCP audit log with a UI in the app, and per-key rate limiting caps a runaway agent. The key is never written to that log, nor to stderr. Under `M00N_DEBUG` the arguments of every tool call are printed to stderr, so treat that output as you would the data itself.

## Troubleshooting

| Symptom | Cause |
|---|---|
| The client shows no M00N Report tools | The config was not reloaded. Restart the client fully, not just the conversation. |
| Tools are listed but every call answers `running unconfigured` | Neither `M00N_API_URL` nor `M00N_API_KEY` reached the process, so it started in preview mode. Check the `env` block actually applies to this server. |
| `M00N_API_KEY should start with "m00n_mcp_"` | That is a project API key, the kind the test reporters use. MCP keys are separate: Settings -> MCP Keys. |
| `Authentication failed: Invalid or expired MCP key` | The key is wrong, revoked, or from another instance. Or `M00N_API_URL` carries an `/api` suffix, which makes every request 401 however good the key is. Check the URL first, then issue a new key. |
| `WARNING: M00N_API_URL is http://...` | Not an error, and the server keeps running. It means the key is sent unencrypted on every request. Use `https` unless the instance is on a trusted private network. Loopback addresses do not warn. |
| `... redirected to ...` | The URL answers with a redirect, and redirects are not followed because the MCP key would travel to wherever they point. Set `M00N_API_URL` to the address that answers directly, usually the `https://` form. |
| `Cannot connect to M00N Report API at ...` | Nothing is listening at that URL. The instance is down, or the port is closed to you. |
| `Cannot resolve M00N Report API host` | The hostname does not resolve. A typo, or a private name reached from outside its network. |
| `Request to M00N Report API timed out` | Raise `M00N_TIMEOUT_MS`, or check the network path. |
| `SSL certificate error connecting to ...` | A self-signed certificate on a self-hosted instance. Set `M00N_INSECURE_SSL` to `true`. |
| `Not found during ...` | The rest of the line is the server's own answer and usually names the fix, such as which projects do exist. Read it before changing a setting. |
| `Rate limit exceeded. Retry after Ns.` | 60 tool calls per minute per key. The message carries the wait. |
| Fewer tools than expected | The key is permission-scoped, or the instance is older than the package. The tool list comes from your instance. |

The server logs to stderr with or without `M00N_DEBUG`, and most clients surface it in their MCP panel. Set `M00N_DEBUG` to `true` to add each request and its arguments.

## Known Limitations

- **The tool list is read once, at startup.** Re-scope a key or upgrade the instance and the client keeps the old list until you restart the client.
- **`GET /api/health` must be reachable when configured.** It is checked before anything else and a failure stops the server, so a proxy forwarding only `/api/mcp/*` shows no tools at all even though every tool would work.
- **A key scoped to zero tools does not start.** The server exits rather than connecting with an empty list. This is the configured path; with no credentials at all it starts in preview mode instead.
- **Prompts and resources are optional.** If their listings fail, the server still starts, with the reason on stderr, and the client sees none of them for the whole session.
- **Redirects are refused, not followed.** The key rides in a custom header, and redirect
  followers strip only the auth headers they recognise, so following one would hand the key to
  whatever host answered next. A redirect is reported with the address it pointed at.
- **stdio only.** For an HTTP transport, use the hosted connector.

## Support

- [Package on npm](https://www.npmjs.com/package/@m00nsolutions/mcp-server)
- [Documentation](https://m00nreport.com/documentation/mcp/quick-start)
- [Report Issues](https://github.com/m00nreport/mcp-server/issues)
- [Community Discord](https://discord.gg/hzZvyVWS3Q)

## License

MIT License. See [LICENSE](https://github.com/m00nreport/mcp-server/blob/main/LICENSE).
