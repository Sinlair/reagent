import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChatService } from "../dist/services/chatService.js";
import { MemoryService } from "../dist/services/memoryService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-chat-module-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService runtime can use module extraction tool in a chat flow", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href === "https://github.com/example/research-repo") {
          return {
            ok: true,
            text: async () => `
              <html>
                <head>
                  <meta property="og:title" content="example/research-repo" />
                  <meta property="og:description" content="Repository for multimodal rag" />
                </head>
                <body>
                  <script type="application/json">{"stargazerCount":45}</script>
                  <a href="/example/research-repo/tree/main/src">src</a>
                </body>
              </html>
            `,
          };
        }
        if (href.includes("archive/refs/heads/main.zip")) {
          return {
            ok: true,
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
          };
        }
        throw new Error(`Unexpected fetch: ${href}`);
      };

      const requests = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              requests.push(params);
              if (requests.length === 1) {
                return {
                  id: "resp-module-1",
                  output_text: "",
                  output: [
                    {
                      type: "function_call",
                      name: "module_extract",
                      arguments: JSON.stringify({ url: "https://github.com/example/research-repo" }),
                      call_id: "call-module-1"
                    }
                  ]
                };
              }

              return {
                id: "resp-module-2",
                output_text: "I downloaded the repository archive and stored the reusable module paths.",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      try {
        const reply = await chat.reply({
          senderId: "chat-user-module-1",
          text: "Look at this GitHub repo and store the reusable module: https://github.com/example/research-repo"
        });

        assert.ok(reply.includes("What I understood"));
        assert.ok(reply.includes("What I did"));
        assert.ok(reply.includes("What you should do next"));
        assert.ok(reply.includes("I downloaded the repository archive and stored the reusable module paths."));
        assert.equal(requests.length, 2);
        assert.equal(requests[0].tools.some((tool) => tool.name === "module_extract"), true);
        assert.equal(String(requests[1].input[0].output).includes("archivePath"), true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  await runTest("ChatService runtime auto chains repo analysis into module extraction", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href === "https://github.com/example/research-repo") {
          return {
            ok: true,
            text: async () => `
              <html>
                <head>
                  <meta property="og:title" content="example/research-repo" />
                  <meta property="og:description" content="Repository for multimodal rag" />
                </head>
                <body>
                  <script type="application/json">{"stargazerCount":45}</script>
                  <a href="/example/research-repo/tree/main/src">src</a>
                </body>
              </html>
            `,
          };
        }
        if (href.includes("archive/refs/heads/main.zip")) {
          return {
            ok: true,
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
          };
        }
        throw new Error(`Unexpected fetch: ${href}`);
      };

      const requests = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              requests.push(params);
              if (requests.length === 1) {
                return {
                  id: "resp-repo-1",
                  output_text: "",
                  output: [
                    {
                      type: "function_call",
                      name: "repo_analyze",
                      arguments: JSON.stringify({ url: "https://github.com/example/research-repo" }),
                      call_id: "call-repo-1"
                    }
                  ]
                };
              }

              return {
                id: "resp-repo-2",
                output_text: "I inspected the repository and captured the reusable module archive.",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      try {
        const reply = await chat.reply({
          senderId: "chat-user-module-2",
          text: "Inspect this repository and keep the reusable code paths: https://github.com/example/research-repo"
        });

        assert.ok(reply.includes("What I understood"));
        assert.ok(reply.includes("What I did"));
        assert.ok(reply.includes("What you should do next"));
        assert.ok(reply.includes("I inspected the repository and captured the reusable module archive."));
        assert.equal(requests.length, 2);
        assert.equal(requests[0].tools.some((tool) => tool.name === "repo_analyze"), true);
        assert.equal(String(requests[1].input[0].output).includes("module_extract"), true);
        assert.equal(String(requests[1].input[0].output).includes("archivePath"), true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
