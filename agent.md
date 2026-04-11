# ReAgent Agent Blueprint

## 0. Current Product Reality

As of 2026-04-08, ReAgent's product reality should follow a "unified CLI control plane + optional Web observation panel" model, not fragmented multi-entry point design.

- The single primary control entry point is `reagent`
- Runtime control is unified under `reagent service ...`
- Runtime inspection is unified under `reagent runtime ...`
- Research workflow is unified under `reagent research ...`
- Channels, memory, config, and plugins are unified under `reagent channels ...`, `reagent memory ...`, `reagent config ...`, `reagent plugins ...`
- `reagent gateway`, `reagent status`, `reagent health`, `reagent logs`, `reagent doctor` are kept only as compatibility aliases, no longer recommended
- The Web UI is positioned for observation, browsing, and auxiliary operations, not for exclusive control capabilities

This means subsequent design decisions must follow three constraints:

1. Do not introduce a second "parallel control plane"
2. New capabilities go into `reagent ...` first; UI only handles mapping and visualization
3. All copy, status pages, deployment pages, and help pages should default to showing `service/runtime/research/...`, not revert to the `gateway` era naming

## 1. One-Line Definition

ReAgent is not a "chatbot with a research button," but rather a local-first, continuously-runnable `Research Workspace / Research OS`.

Its mission is to continuously accomplish the following around a clearly defined research direction:

- Discover new papers and related sources
- Normalize papers, articles, repositories, and evidence
- Produce evidence-backed research reports
- Extract reusable modules and implementation insights
- Generate weekly summaries, baseline maps, and group meeting PPTs
- Deliver stably through Web / WeChat / OpenClaw and other channels
- Write feedback and results back to memory, driving the next research cycle

## 2. Why Reference Open Source Projects

ReAgent should not operate in isolation.

Several clear research agent directions have already emerged in the open source space:

- Deep research report pipeline
- Long-task workbench approach
- Academic retrieval optimization
- Multi-agent enterprise analysis
- Paper-to-tool/Agent translation
- Automated scientific discovery

ReAgent's rational approach is not to copy any single project, but to extract product boundaries and technical priorities suited to itself from these projects.

## 3. Open Source Reference Systems

### 3.1 [GPT Researcher](https://github.com/assafelovic/gpt-researcher)

Key learnings:

- Defines "deep research" as a standard workflow, not just a regular conversation
- Structures research as `planner -> execution -> publisher`
- Reports must emphasize citation, source tracking, and traceability
- Supports unified output for both web research and local research
- Tree-based exploration for complex research paths instead of linear search

Implications for ReAgent:

- ReAgent's core output must be high-quality research artifacts, not ad-hoc answers
- Report structure, evidence citation, and source tracking should be default capabilities
- For directional research, should support mixed "breadth discovery + depth drilling" workflows

### 3.2 [DeerFlow](https://github.com/bytedance/deer-flow)

Key learnings:

- Designs agents as long-horizon harnesses, not single-turn assistants
- Memory, tools, skills, subagents, and gateway are all first-class citizens
- Tasks may run for minutes to hours, so state visibility is critical
- Local deployment, controllable permissions, and observability are product capabilities, not afterthoughts

Implications for ReAgent:

- ReAgent should be a long-running workbench, not just focused on "Q&A experience"
- Research tasks need explicit state, audit trails, recovery, and plan execution
- Memory, skills, channel integration, and runtime boundaries must be clear, not mixed into prompts
- Local trustworthy environment and observable execution are core advantages

### 3.3 [PaSa](https://github.com/bytedance/pasa)

Key learnings:

- Academic retrieval itself is the core problem, not just a simple wrapper around search APIs
- Paper search requires continuous decision-making: invoke search tools, read papers, filter references, extend retrieval
- Retrieval quality determines subsequent report quality

Implications for ReAgent:

- ReAgent must place paper discovery and academic retrieval at its core capabilities
- "What to search, why search, whether to extend reference chains" should be explicit decisions
- Research direction briefs must directly drive retrieval strategy, not just serve as labels

### 3.4 [Enterprise Deep Research](https://github.com/SalesforceAIResearch/enterprise-deep-research)

Key learnings:

- Uses master planning agent for query decomposition
- Uses specialized search agents to handle general search, academic search, GitHub search, etc.
- Reflection mechanism identifies knowledge gaps and corrects direction
- Human-in-the-loop steering allows course correction during long tasks
- Progress tracking, streaming, and benchmarking are product-level capabilities

Implications for ReAgent:

- ReAgent needs to incorporate task decomposition, specialized search roles, reflection loops, and human steering
- The workbench must show task progress, not just final results
- If multi-agent design is future work, it must improve clarity and throughput, not just "look advanced"

### 3.5 [Paper2Agent](https://github.com/jmiao24/Paper2Agent)

Key learnings:

- Strong papers can not only be summarized but also converted into interactive tools or specialized agents
- Extracting MCP servers, tools, tests, and quality reports from papers/repos is a reusable path
- Research results can eventually enter the "actionable asset layer"

Implications for ReAgent:

- ReAgent should not stop at "finishing paper reading"
- For high-value papers, should later support extracting modules, tool drafts, and experiment reproduction entry points
- `module_asset` should become a formal object, not just a report section

### 3.6 [InternAgent](https://github.com/InternScience/InternAgent)

Key learnings:

- Long-cycle scientific discovery can be decomposed into `Generation -> Verification -> Evolution`
- Literature analysis, knowledge synthesis, hypothesis building, verification, and long-term memory form a unified system
- Multi-source knowledge integration is closer to real research work than single-source summarization

Implications for ReAgent:

- ReAgent's positioning should be "research cycle system," not "research summarizer"
- Directional research cannot stop at reading; must support verification-driven next steps
- Memory should serve subsequent research evolution, not just store chat history

### 3.7 [AI Scientist-v2](https://github.com/SakanaAI/AI-Scientist-v2)

Key learnings:

- Automated scientific discovery can extend to hypothesis generation, experiment execution, result analysis, and paper writing
- Tree search is effective for exploring complex research paths

Implications for ReAgent:

- Ideation, novelty gates, and automated experiments are later extensible directions
- These capabilities must come after foundational workbench, retrieval, evidence chains, and artifact systems

## 4. ReAgent's Product Conclusions After Reference Analysis

### 4.1 Product Center Must Be "Research Cycle," Not Chat

ReAgent's main pipeline should be:

`Research Brief -> Discovery -> Normalize -> Analyze -> Synthesize -> Deliver -> Feedback -> Memory`

Not:

`Chat -> More Chat -> Longer Chat`

### 4.2 Most Important Is Not "Able to Answer," But "Able to Deliver"

ReAgent's most valuable outputs should be:

- daily brief
- paper brief
- deep paper report
- repo report
- direction report
- baseline map
- weekly summary
- group meeting deck

Chat is just one entry point, not the product itself.

### 4.3 Most Important Is Not "Finding Many," But "Filtering What Matters"

From PaSa and GPT Researcher, a research system's true value lies in:

- Query generation
- Retrieval expansion
- Result filtering
- Evidence organization
- Conclusion generation

Therefore ReAgent should prioritize improving discovery quality, not just stacking more sources.

### 4.4 Multi-Agent Is a Tool, Not the Goal

From DeerFlow, Enterprise Deep Research, and InternAgent, multi-agent is only worth introducing in these scenarios:

- Long task decomposition
- Specialized retrieval from different sources
- Reflection and course correction
- Result synthesis and artifact production

Without clear role boundaries, multi-agent only adds complexity.

## 5. ReAgent's Target Product Form

ReAgent should be built as a local research workbench, organized around three layers.

### 5.1 Evidence Layer

Manages research evidence:

- Papers
- PDFs
- Article links
- GitHub repositories
- Citation chains
- Evidence snippets
- Charts

### 5.2 Memory Layer

Manages long-term context:

- Research brief
- User preferences
- Historical reports
- Baseline comparisons
- Reusable modules
- Feedback records

### 5.3 Delivery Layer

Manages stable delivery:

- Web workbench
- WeChat push
- OpenClaw plugin
- Daily/Weekly reports
- Group meeting materials

## 6. Core Object Model

After referencing GPT Researcher, Paper2Agent, and Enterprise Deep Research, ReAgent should standardize on the following objects:

### `ResearchBrief`

Describes the goal, constraints, evaluation criteria, and delivery preferences of a research direction.

Must include at minimum:

- title
- tl;dr
- abstract
- background
- target problem
- success criteria
- blocked directions
- known baselines
- preferred venues
- preferred datasets / benchmarks
- current questions
- short-term validation targets

### `SourceItem`

Represents an external source item, for example:

- WeChat public account article
- Xiaohongshu note
- Zhihu answer
- Blog post
- Project page
- arXiv page
- DOI page

### `Paper`

Normalized paper entity, associated with:

- metadata
- PDF
- source entry
- citation information
- related directions
- conclusion summary
- evidence index

### `Repo`

Normalized repository entity, associated with:

- official / unofficial
- stars / activity
- setup complexity
- important folders
- reproducibility risk

### `ModuleAsset`

Reusable modules, code insights, engineering tricks, or tool drafts extracted from repos.

### `Report`

Standardized representation of:

- paper brief
- deep paper report
- repo report
- direction report
- weekly report

### `PresentationAsset`

Standardized representation of:

- PPT outline
- slide notes
- figures
- final deck

### `Feedback`

Represents explicit user feedback on results, used to influence ranking, push thresholds, and direction profiling.

### `ResearchRound`

Represents one complete research activity, linking:

- brief
- discovery candidates
- selected papers
- reports
- decisions
- delivery outputs

## 7. ReAgent's Core Workflows

### 7.1 Brief-Driven Discovery

Following PaSa, ReAgent's discovery cannot be fixed keyword search, but must be brief-driven.

The system needs to:

- Auto-generate queries from brief
- Extend relevant queries based on target problems
- Search recent papers
- Search project pages and GitHub repositories
- Rank discovery candidates by relevance and value
- Aggregate duplicate candidates

### 7.2 Article-To-Paper Normalization

Following real research scenarios, users often send articles, not arXiv links.

The system must be able to identify from articles:

- Paper title
- arXiv / DOI
- Project page
- GitHub link
- Descriptive statements about the paper

And merge these entry points into a standard `paper candidate`.

### 7.3 Evidence-Backed Paper Analysis

Following GPT Researcher, output cannot be just a generalized summary.

Each paper must at minimum answer:

1. What problem does it solve?
2. What is the core method?
3. What is the true novelty?
4. What comparisons with baselines?
5. Which modules can be reused?
6. What are the risks, shortcomings, and uncertainties?
7. Is further action warranted?

### 7.4 Repo Mining

Following Paper2Agent, code repository analysis should be a formal capability.

The system must be able to:

- Find official / unofficial repositories
- Analyze directory structure
- Identify key modules
- Judge reproduction cost
- Save repository snapshots or selected modules
- Form module notes

### 7.5 Synthesis

Following GPT Researcher, InternAgent, and Enterprise Deep Research, ReAgent must support multi-paper synthesis:

- baseline map
- representative paper set
- common modules
- trend summary
- candidate innovation routes
- meeting deck

### 7.6 Feedback And Iteration

Following DeerFlow and Enterprise Deep Research, long tasks cannot lack steering mechanisms.

Users should be able to quickly express:

- Useful / not useful
- More / less
- Too theoretical / too engineering
- Worth follow-up / ignore for now

The system then updates:

- Ranking strategy
- Push strategy
- Brief profiling
- Next round exploration focus

## 8. Structured Output

### 8.1 Daily Paper Brief

Must include at minimum:

- Title
- Source
- Date
- Relevance reason
- Novelty guess
- Code availability
- Recommendation level

### 8.2 Deep Paper Report

Must include at minimum:

- Metadata
- Source link
- Problem definition
- Method structure
- Innovation points
- Baseline comparison
- Strengths and weaknesses
- Repo situation
- Reusable modules
- Next steps recommendation
- Evidence citations
- Confidence level

### 8.3 Repo Report

Must include at minimum:

- Repository link
- Officiality judgment
- Activity level
- Key directories
- Reproduction complexity
- Key modules
- Risk notes

### 8.4 Direction Report

Must include at minimum:

- Direction overview
- Representative papers
- Baseline map
- Common modules
- Underexplored combinations
- Possible next steps

### 8.5 Group Meeting Deck Package

Must include at minimum:

- Meeting outline
- Per-slide notes
- Key charts
- Citation list
- Final export file or source file

## 9. Task State Machine

Following DeerFlow and Enterprise Deep Research, ReAgent's tasks must be visible, recoverable, and retryable.

Recommended states include at minimum:

- `queued`
- `fetching`
- `parsing`
- `normalizing`
- `searching-paper`
- `downloading-paper`
- `analyzing-paper`
- `checking-repo`
- `extracting-module`
- `synthesizing`
- `generating-ppt`
- `delivering`
- `completed`
- `failed`

## 10. System Module Recommendations

### 10.1 Brief Manager

Manages research directions, research briefs, and user preferences.

### 10.2 Discovery Engine

Responsible for query generation, source pulling, candidate aggregation, and initial ranking.

### 10.3 Ranking Layer

Responsible for:

- Relevance scoring
- Novelty estimation
- Reproducibility scoring
- Recommendation classification

### 10.4 Ingestion Engine

Responsible for:

- Download PDFs
- Parse full text
- Extract charts
- Mark evidence locations

### 10.5 Analysis Engine

Responsible for:

- Method analysis
- Baseline analysis
- Weakness identification
- Evidence and inference layering

### 10.6 Repo Mining Engine

Responsible for:

- Repo search
- Officiality judgment
- Key module extraction
- Module asset generation

### 10.7 Synthesis Engine

Responsible for:

- Multi-paper comparison
- Direction-level summarization
- Weekly reports
- Group meeting materials

### 10.8 Delivery Layer

Responsible for:

- Web display
- WeChat push
- OpenClaw integration
- Export and notification

### 10.9 Feedback Engine

Responsible for:

- Record feedback
- Adjust ranking
- Update brief profiling
- Drive next round research

## 11. MVP Priority

After synthesizing open source reference projects, the most important priorities for ReAgent currently are:

### P0

- Structured `Research Brief`
- Brief-driven discovery
- `article -> paper -> repo` normalization
- Evidence-backed deep paper report
- WeChat daily push

### P1

- Repo mining
- Module asset extraction
- Direction report
- Weekly summary
- Group meeting PPT outline

### P2

- Specialized sub-agents
- Steering / reflection
- Artifact retrieval
- OpenClaw parity

### P3

- Paper-to-agent / MCP translation
- Ideation
- Novelty gates
- Automated experiment execution

## 12. Clear Non-Goals

ReAgent should not prioritize becoming:

- A general-purpose chatbot
- A deep research tool that only writes one long report
- An AI Scientist focused primarily on automated experiment execution
- A prompt shell without artifact and memory layers

## 13. Key Product Principles

### 13.1 Quality Over Quantity

Better to push fewer papers daily than to clog channels with low-relevance papers.

### 13.2 Judgment Over Restatement

Users truly need "how to handle this paper," not longer summarization.

### 13.3 Evidence Over Writing Style

Conclusions must clearly distinguish between:

- Direct paper support
- Code evidence support
- Agent inference
- Explicit speculation

### 13.4 Artifacts Over Chat History

True value lies in reusable artifacts, not long conversation histories.

### 13.5 Local Control Over Black-box Automation

Deployment, permissions, state, memory, and artifacts should be as inspectable, interventional, and recoverable as possible.

## 14. Final Definition

ReAgent's goal is to turn "continuous research" into a runnable, traceable, and accumulative workflow system.

It should ultimately help users:

- Know which directions are worth following
- Quickly discover high-value papers
- Support research decisions with evidence
- Find reusable modules and implementation entry points
- Generate weekly reports and group meeting materials
- Crystallize all results into inputs for the next research round

If users gradually move from "information overload" to "evidence-backed research decisions + reusable artifacts" after using ReAgent, then the product direction is correct.
