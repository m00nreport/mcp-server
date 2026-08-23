// list-shapes.ts - the wire shape of everything the server lists
//
// The live server projects these from what your instance returned; preview mode
// projects them from the snapshot. Two call sites for the same four shapes, and
// a listing that disagrees between them is a bug no test would notice, because
// each side looks correct on its own. Shared here so the compiler enforces it.
//
// Identity projections on purpose: they exist to say which fields go on the
// wire, so an extra field arriving from the API is dropped rather than passed
// through untouched.

import { Tool, StaticResource, ResourceTemplate, Prompt } from './api-client.js';

export function toToolDefinition(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // MCP 2025 spec, and optional: only sent when the instance supplied it.
    ...(tool.annotations && { annotations: tool.annotations }),
  };
}

export function toResourceDefinition(resource: StaticResource) {
  return {
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  };
}

export function toTemplateDefinition(template: ResourceTemplate) {
  return {
    uriTemplate: template.uriTemplate,
    name: template.name,
    description: template.description,
    mimeType: template.mimeType,
  };
}

export function toPromptDefinition(prompt: Prompt) {
  return {
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required,
    })),
  };
}
