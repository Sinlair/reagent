import assert from "node:assert/strict";

import { ArxivPaperSearchProvider } from "../dist/providers/search/arxivPaperSearchProvider.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await runTest("ArxivPaperSearchProvider parses Atom feed entries into paper candidates", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2501.01234v1</id>
    <updated>2026-04-01T12:00:00Z</updated>
    <published>2026-04-01T12:00:00Z</published>
    <title>  A Strong Multimodal RAG Paper  </title>
    <summary>We introduce a practical retrieval module for long multimodal documents.</summary>
    <author><name>A. Researcher</name></author>
    <author><name>B. Engineer</name></author>
    <link href="http://arxiv.org/abs/2501.01234v1" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2501.01234v1" rel="related" type="application/pdf"/>
    <arxiv:doi>10.48550/arXiv.2501.01234</arxiv:doi>
  </entry>
</feed>`
    });

    try {
      const provider = new ArxivPaperSearchProvider();
      const papers = await provider.search({
        request: { topic: "multimodal rag", maxPapers: 5 },
        plan: {
          objective: "Find recent work",
          subquestions: [],
          searchQueries: ["multimodal rag"]
        }
      });

      assert.equal(papers.length, 1);
      assert.equal(papers[0]?.source, "arxiv");
      assert.equal(papers[0]?.title, "A Strong Multimodal RAG Paper");
      assert.equal(papers[0]?.authors.length, 2);
      assert.equal(papers[0]?.pdfUrl, "http://arxiv.org/pdf/2501.01234v1");
      assert.equal(papers[0]?.year, 2026);
      assert.equal(papers[0]?.venue, "arXiv");
    } finally {
      global.fetch = originalFetch;
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
