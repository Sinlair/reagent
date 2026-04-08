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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-chat-tools-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService runtime can use link ingestion tool in a chat flow", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href === "https://example.com/post") {
          return {
            ok: true,
            text: async () => `
              <html>
                <head><title>Article About RAG</title></head>
                <body>
                  <a href="https://arxiv.org/abs/2501.12345">paper</a>
                  <a href="https://github.com/example/research-repo">code</a>
                </body>
              </html>
            `,
          };
        }
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
        if (href.includes("arxiv.org/pdf/2501.12345.pdf")) {
          return {
            ok: false,
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(0),
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
                  id: "resp-link-1",
                  output_text: "",
                  output: [
                    {
                      type: "function_call",
                      name: "link_ingest",
                      arguments: JSON.stringify({ url: "https://example.com/post" }),
                      call_id: "call-link-1"
                    }
                  ]
                };
              }

              return {
                id: "resp-link-2",
                output_text: "I extracted one paper candidate and one GitHub repo candidate.",
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
          senderId: "chat-user-1",
          text: "Read this article and tell me what paper and GitHub repo it mentions: https://example.com/post"
        });

        assert.ok(reply.includes("What I understood"));
        assert.ok(reply.includes("What I did"));
        assert.ok(reply.includes("What you should do next"));
        assert.ok(reply.includes("I extracted one paper candidate and one GitHub repo candidate."));
        assert.equal(requests.length, 2);
        assert.equal(requests[0].tools.some((tool) => tool.name === "link_ingest"), true);
        assert.equal(requests[0].tools.some((tool) => tool.name === "graph_query"), true);
        assert.equal(requests[0].tools.some((tool) => tool.name === "graph_report"), true);
        assert.equal(requests[0].tools.some((tool) => tool.name === "graph_explain"), true);
        assert.equal(String(requests[1].input[0].output).includes("2501.12345"), true);
        assert.equal(String(requests[1].input[0].output).includes("research-repo"), true);
        assert.equal(String(requests[1].input[0].output).includes("autoChain"), true);
        assert.equal(String(requests[1].input[0].output).includes("paper_analyze"), true);
        assert.equal(String(requests[1].input[0].output).includes("repo_analyze"), true);
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
