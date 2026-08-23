# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report is
readable by everyone, including whoever would exploit it, from the moment it is
filed.

Two private channels, in order of preference:

1. **GitHub private vulnerability reporting** - the "Report a vulnerability"
   button on this repository's Security tab. It is the fastest route, it needs no
   mailbox on either side, and it keeps the whole exchange attached to the code.
2. **security@m00nreport.com** if you would rather use email, or if private
   reporting is unavailable to you.

Tell us what you can: what the flaw is, how to reach it, and what an attacker
gets. A rough report sent early is more useful than a polished one sent late.

## What to expect

- An acknowledgement within 3 working days.
- An assessment, with our view of severity and a rough timeline, within 10
  working days.
- Credit in the release notes if you want it, and none if you do not.

We will tell you when a fix ships and to which version. If we disagree that
something is a vulnerability we will say so plainly, with our reasoning, rather
than letting the report go quiet.

## Scope

This repository is the M00N Report MCP server. An MCP client launches it as a
local process, it speaks the Model Context Protocol on stdio, and it calls a
M00N Report instance over HTTPS using an MCP key.

In scope, and the areas worth looking at hardest:

- Anything that discloses the MCP key, or a URL carrying it, to a place it does
  not belong: stdout, a log line, an error message, a crash dump, or a host
  other than the one configured.
- Anything that lets a key reach data outside the permissions it was scoped to.
- Anything that makes this process execute data it received, from the instance
  or from the client, as code.
- Anything reachable through a malicious or compromised instance, since
  `M00N_API_URL` is configuration and can be pointed anywhere.
- Anything that lets a tool call, a prompt or a resource read escape the
  protocol: writing to stdout would corrupt the MCP stream itself.

Out of scope: the hosted M00N Report service, which has its own reporting path
at https://m00nreport.com; the test reporter packages, which are separate
repositories; and reports that consist only of an automated scanner's output
with no demonstrated impact.

## Supported versions

The latest published release is supported. Fixes are issued as a new release
rather than as patches to older ones, because the registries this ships to serve
whatever is current.
