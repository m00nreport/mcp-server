# @m00nsolutions/mcp-server

[![npm](https://img.shields.io/npm/v/@m00nsolutions/mcp-server.svg)](https://www.npmjs.com/package/@m00nsolutions/mcp-server)
[![CI](https://github.com/m00nreport/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/m00nreport/mcp-server/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@m00nsolutions/mcp-server.svg)](https://www.npmjs.com/package/@m00nsolutions/mcp-server)
[![license](https://img.shields.io/npm/l/@m00nsolutions/mcp-server.svg)](LICENSE)

Agentic test management over MCP. M00N Report is an AI-native test management platform: manage test cases, manual runs and releases, with real-time automated results and a 50+ tool MCP server.

This server lets an AI assistant do the work, not just read about it: author test cases, plan and populate manual test executions, link automation back to the manual cases it covers, cut releases, and read project health - the same actions a human takes in the app, through **50+ tools**, guided prompts and read-only resources.

**Which transport do I need?**

| | This npm package (stdio) | Hosted remote connector |
|---|---|---|
| How it runs | `npx @m00nsolutions/mcp-server` as a local process | No local process; the MCP client talks to the API directly over HTTP |
| Auth | `M00N_API_KEY` (an MCP key) | OAuth 2.1 with PKCE, browser consent screen |
| Clients | Any MCP client - Claude Desktop, Claude Code, Cursor, and others | **claude.ai and claude.com only** |

If you are not connecting from claude.ai or claude.com, use this package with an MCP key - that is the rest of this README.

## Features

**Author test assets**
- ✍️ **Write test cases** - `create_test_case` / `update_test_case` accept Markdown, auto-create the folder/suite hierarchy and tags, and can attach a Jira ticket atomically at creation
- 🗂️ **Organize with folders** - Full folder/suite hierarchy management
- 🔗 **Link automation to cases** - `link_autotest_to_case` connects an automated test to the manual case it covers

**Plan a manual test cycle**
- 📋 **Build an execution** - `create_execution`, then populate it with `add_collections_to_execution`, `add_suites_to_execution` or `add_cases_to_execution`
- 📦 **Reusable test collections** - Manage manual test runs and executions
- 🚀 **Release management** - Track releases with linked test runs

**Analyze**
- 📊 **Query test trends** - Pass rates, failing tests, flaky tests over time
- 📈 **Get launch statistics** - Test run summaries with filtering
- 🩺 **Project health** - Composite 0-100 health score with prioritized recommendations

**Governed like the rest of the system**
- 🔗 **External ticket linking** - Bidirectional Jira links + multi-provider support (Linear, GitHub, GitLab, ...)
- 🔒 **Secure** - Uses your MCP key with your permissions
- 🏢 **Self-hosted ready** - Works with self-hosted M00N Report instances
- 🏷️ **Tool annotations** - MCP 2025 spec compliant with safety hints
- 📖 **Resources** - Read-only data access for summaries and reports
- 🎯 **Prompts** - Guided workflow templates for common tasks

## Quick Start

### 1. Get an MCP Key

1. Log in to M00N Report
2. Go to **Settings → MCP Keys**
3. Create a new MCP key
4. Copy the key (starts with `m00n_mcp_`)

### 2. Configure Cursor

Add to your Cursor MCP configuration (`~/.cursor/mcp.json` or workspace `.cursor/mcp.json`):

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

### 3. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

## Available Resources (8)

Resources provide **read-only data** that AI clients can access directly without tool calls. They're perfect for summaries, reports, and structured data.

| Resource URI | Name | Format | Description |
|--------------|------|--------|-------------|
| `m00n://projects` | All Projects | JSON | List of all accessible projects with counts |
| `m00n://projects/{projectId}/summary` | Project Health | JSON | Pass rates, flaky count, latest run info |
| `m00n://projects/{projectId}/flaky-tests` | Flaky Tests | Markdown | Flaky tests report with patterns |
| `m00n://projects/{projectId}/failing-tests` | Failing Tests | Markdown | Currently failing tests from latest run |
| `m00n://projects/{projectId}/folder-tree` | Folder Tree | JSON | Hierarchical folder/suite structure |
| `m00n://launches/{launchId}/report` | Launch Report | Markdown | Full test run report with failures |
| `m00n://cases/{caseId}/content` | Test Case | Markdown | Test case with steps and metadata |
| `m00n://releases/{releaseId}/summary` | Release Summary | JSON | Release health with test run stats |

**Example prompts using resources:**
- "Show me the project health summary"
- "What's in the flaky tests report for project X?"
- "Get the full launch report for the latest run"
- "Show me the test case TC-001 content"

---

## Available Prompts (6)

Prompts are **guided workflow templates** that provide context and instructions for common tasks. They help AI assistants perform complex multi-step operations effectively.

| Prompt | Description |
|--------|-------------|
| `analyze_flaky_tests` | Investigate flaky tests, identify patterns, and suggest fixes |
| `debug_test_failure` | Debug a test failure by analyzing errors and history |
| `release_readiness` | Assess if a release is ready to ship |
| `generate_test_cases` | Generate test cases from a feature description |
| `weekly_health_report` | Generate a comprehensive weekly test health report |
| `investigate_regression` | Investigate when and why a test started failing |

### Prompt Arguments

**analyze_flaky_tests**
- `projectId` (required) - Project UUID to analyze
- `days` (optional) - Lookback period in days (default: 14)

**debug_test_failure**
- `launchId` (required) - Launch/run UUID containing the failure
- `testSearch` (optional) - Test name or path to search for

**release_readiness**
- `releaseId` (required) - Release UUID to assess

**generate_test_cases**
- `featureDescription` (required) - Description of the feature to test
- `folderId` (required) - Target folder UUID
- `testType` (optional) - functional, edge-cases, negative, security, performance

**weekly_health_report**
- `projectId` (required) - Project UUID to report on

**investigate_regression**
- `projectId` (required) - Project UUID
- `testTitlePath` (required) - Full or partial test title path

**Example usage:**
- "Use the analyze_flaky_tests prompt for project abc-123"
- "Help me debug the test failures in run xyz-456"
- "Is release v2.1.0 ready to ship?"
- "Generate test cases for the user registration feature"

---

## Available Tools (50)

All tools include **MCP 2025 annotations** to help AI clients understand tool safety characteristics.

### Analytics & AI Tools (Read-Only)
| Tool | Description |
|------|-------------|
| `list_projects` | List all accessible projects |
| `get_launches_trends` | Get pass rate, flaky, failing test trends |
| `get_launches_statistics` | Get test run summaries with filtering |
| `get_launch_tests` | Get all tests from a specific run |
| `get_test_history` | Get execution history for a test |
| `search_tests` | Search tests by title or file path |
| `run_health_check` | 🆕 Get overall project health score (0-100) with recommendations |
| `get_coverage_gaps` | 🆕 Identify test cases without linked autotests |
| `suggest_test_cases` | Project-aware scaffolding from a feature description - pattern matching over templates, not LLM generation. Your assistant writes the real case content; `create_test_case` persists it |
| `export_report` | 🆕 Generate markdown reports (summary, failures, trends, release) |
| `get_feature_scan` | 🆕 Feature health scan by Jira key - coverage stats, linked cases, autotest run trends (aggregates child issues 2 levels deep) |

### Bulk Operations
| Tool | Annotations | Description |
|------|-------------|-------------|
| `bulk_update_cases` | ✏️ update | 🆕 Update multiple test cases at once (status, priority, tags) |

### Test Case Management
| Tool | Annotations | Description |
|------|-------------|-------------|
| `list_test_cases` | 🔒 read-only | List test cases with filtering |
| `get_test_case` | 🔒 read-only | Get full test case details |
| `get_case_execution_history` | 🔒 read-only | Manual execution history for a case across runs, with pass-rate summary |
| `create_test_case` | ✏️ create | Create a new test case (accepts optional `externalLinks[]` to atomically attach Jira / Linear / GitHub tickets at creation time) |
| `update_test_case` | ✏️ update | Update an existing test case |
| `delete_test_case` | ⚠️ destructive | Archive a test case |
| `move_test_case` | ✏️ update | Move to different folder |
| `link_autotest_to_case` | 🔗 link | Link automated test to case |

### External Ticket Links 🆕
Link any M00N entity (case, execution, release, launch) to an external ticket in Jira, Linear, GitHub, GitLab, or any other system. For Jira, the flow is **bidirectional**: M00N fetches the issue metadata and pushes a Remote Link back to the Jira issue page, mirroring the manual Jira-panel link experience.

| Tool | Annotations | Description |
|------|-------------|-------------|
| `add_external_link` | 🔗 link | Link a case / execution / release / launch to an external ticket. For Jira: pass the issue key (e.g. `PROJ-123`) or a full `/browse/` URL as `externalId`; metadata + URL are fetched automatically and a Remote Link is pushed to Jira. For other providers: `externalUrl` is required. Idempotent. |
| `list_external_links` | 🔒 read-only | List external links attached to an entity, optionally filtered by provider |
| `remove_external_link` | ⚠️ destructive | Remove a link by its UUID. For Jira-backed links, also deletes the corresponding Remote Link on the Jira side. |

### Folder Management
| Tool | Annotations | Description |
|------|-------------|-------------|
| `list_folders` | 🔒 read-only | List all folders/suites |
| `get_folder` | 🔒 read-only | Get folder details |
| `create_folder` | ✏️ create | Create a folder (a branch container that holds folders and suites) |
| `create_suite` | ✏️ create | Create a suite (a leaf container that holds test cases) inside a folder |
| `update_folder` | ✏️ update | Rename or move folder |
| `delete_folder` | ⚠️ destructive | Archive folder and contents |
| `get_folder_statistics` | 🔒 read-only | Get folder statistics |

### Manual Test Executions
An execution is a manual test run: assignees, environment, dates, and per-step results captured against a snapshot of each case at the moment it was added.

| Tool | Annotations | Description |
|------|-------------|-------------|
| `list_executions` | 🔒 read-only | List manual test executions with status and progress |
| `get_execution` | 🔒 read-only | Get an execution with its cases, assignees and per-case results |
| `create_execution` | ✏️ create | Create a manual test execution |
| `add_collections_to_execution` | 🔗 link | Add every case in one or more test collections to an execution |
| `add_suites_to_execution` | 🔗 link | Add every case in one or more suites to an execution |
| `add_cases_to_execution` | 🔗 link | Add individually chosen cases to an execution as a named group |

### Test Collections (Reusable Case Sets)
| Tool | Annotations | Description |
|------|-------------|-------------|
| `list_test_collections` | 🔒 read-only | List test collections |
| `get_test_collection` | 🔒 read-only | Get collection with execution status |
| `create_test_collection` | ✏️ create | Create a reusable test collection |
| `update_test_collection` | ✏️ update | Update collection metadata |
| `add_cases_to_collection` | 🔗 link | Add cases to collection |
| `remove_cases_from_collection` | ⚠️ remove | Remove cases from collection |
| `delete_test_collection` | ⚠️ destructive | Archive collection |

### Release Management
| Tool | Annotations | Description |
|------|-------------|-------------|
| `list_releases` | 🔒 read-only | List releases with stats |
| `get_release` | 🔒 read-only | Get release with test runs |
| `create_release` | ✏️ create | Create a new release |
| `update_release` | ✏️ update | Update release metadata |
| `delete_release` | ⚠️ destructive | Archive release |
| `link_launches_to_release` | 🔗 link | Link automated runs to release |
| `unlink_launch_from_release` | ⚠️ remove | Remove launch from release |

## Tool Annotations

All tools include MCP 2025 spec-compliant annotations that help AI assistants understand tool behavior:

| Annotation | Meaning |
|------------|---------|
| `readOnlyHint: true` | 🔒 Tool only reads data, no side effects |
| `destructiveHint: true` | ⚠️ Tool may delete or archive data |
| `idempotentHint: true` | 🔄 Safe to call repeatedly with same args |
| `openWorldHint: false` | 📦 Tool operates only on known entities |

**Example annotation:**
```json
{
  "name": "delete_test_case",
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": true,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

AI assistants use these hints to:
- Warn users before executing destructive operations
- Batch read-only operations without confirmation
- Safely retry idempotent operations on failure

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `M00N_API_URL` | ✅ | - | M00N Report API URL (e.g., `https://m00nreport.com`) |
| `M00N_API_KEY` | ✅ | - | MCP key from Settings → MCP Keys |
| `M00N_INSECURE_SSL` | | `false` | Skip SSL verification (for self-signed certs) |
| `M00N_DEBUG` | | `false` | Enable verbose logging |
| `M00N_TIMEOUT_MS` | | `30000` | Request timeout in milliseconds |

## Self-Hosted Installation

### Standard Installation

Works with any self-hosted M00N Report instance:

```json
{
  "mcpServers": {
    "m00n": {
      "command": "npx",
      "args": ["-y", "@m00nsolutions/mcp-server"],
      "env": {
        "M00N_API_URL": "https://your-m00n-instance.company.com",
        "M00N_API_KEY": "m00n_mcp_your_key_here"
      }
    }
  }
}
```

### Self-Signed Certificates

For self-hosted instances with self-signed SSL certificates:

```json
{
  "mcpServers": {
    "m00n": {
      "command": "npx",
      "args": ["-y", "@m00nsolutions/mcp-server"],
      "env": {
        "M00N_API_URL": "https://your-m00n-instance.company.com",
        "M00N_API_KEY": "m00n_mcp_your_key_here",
        "M00N_INSECURE_SSL": "true"
      }
    }
  }
}
```

⚠️ **Security Note:** Only use `M00N_INSECURE_SSL=true` for trusted internal servers with self-signed certificates.

### Offline/Air-Gapped Installation

For environments without internet access:

1. On a machine with internet, create a tarball:
   ```bash
   npm pack @m00nsolutions/mcp-server
   ```

2. Transfer the resulting `m00nsolutions-mcp-server-<version>.tgz` to the air-gapped machine

3. Install from tarball:
   ```bash
   npm install -g ./m00nsolutions-mcp-server-<version>.tgz
   ```

4. Configure to use the global installation:
   ```json
   {
     "mcpServers": {
       "m00n": {
         "command": "m00n-mcp",
         "env": {
           "M00N_API_URL": "https://your-m00n-instance.company.com",
           "M00N_API_KEY": "m00n_mcp_your_key_here"
         }
       }
     }
   }
   ```

## Troubleshooting

### "Cannot connect to M00N Report API"

- Verify `M00N_API_URL` is correct and accessible
- Check network connectivity to the M00N Report server
- For self-hosted: ensure the API port (default 4000) is accessible

### "Authentication failed: Invalid or expired MCP key"

- Verify `M00N_API_KEY` starts with `m00n_mcp_`
- Check the key hasn't been revoked in Settings → MCP Keys
- Ensure you're using an MCP key, not a project API key

### "SSL certificate error"

- For self-signed certificates, set `M00N_INSECURE_SSL=true`
- Verify the certificate chain if using a private CA

### "No tools available"

- Check your MCP key has appropriate permissions
- Verify your user account has access to at least one project

### Enable Debug Logging

Set `M00N_DEBUG=true` to see detailed logs:

```json
{
  "env": {
    "M00N_API_URL": "...",
    "M00N_API_KEY": "...",
    "M00N_DEBUG": "true"
  }
}
```

## Example Prompts

Once configured, try these prompts in Claude or Cursor:

### Analytics & Health
- "List my M00N Report projects"
- "Show me the test pass rate trends for the last 30 days"
- "What are the top 10 flaky tests in project X?"
- "Get me the failed test runs from this week"
- "Which tests are taking the longest to run?"
- "Run a health check on my project"
- "What's the overall health score for project X?"

### Coverage Analysis
- "Show me the test coverage gaps in my project"
- "Which test cases don't have automated tests?"
- "Which folders have low automation coverage?"

### AI-Assisted
- "Suggest test cases for the user login feature"
- "Generate test case ideas for: users can upload profile pictures up to 5MB"
- "Create edge case tests for the payment checkout flow"

### Bulk Operations
- "Update all test cases TC-001, TC-002, TC-003 to status Approved"
- "Add the 'regression' tag to all selected test cases"
- "Set priority to High for these 5 test cases"

### Reporting
- "Generate a summary report for my project"
- "Export a failures report for the last 7 days"
- "Show me the trends report in markdown format"
- "Generate a release status report for release v2.1.0"

### External Ticket Links
- "Link test case TC-42 to Jira issue PROJ-123"
- "Create a test case for the password reset flow and link it to M00NPROJ-22"
- "Show me all Jira tickets linked to test case TC-42"
- "Unlink ticket PROJ-456 from test case TC-42"
- "Create a test case 'Login with valid credentials' and link it to Linear ENG-789"

## Support

- **Package on npm:** https://www.npmjs.com/package/@m00nsolutions/mcp-server
- **Documentation:** https://m00nreport.com/documentation/getting-started
- **Issues:** https://github.com/m00nreport/mcp-server/issues
- **Email:** support@m00nreport.com

## License

MIT
