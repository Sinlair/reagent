# Research Agent

## Goal

Build a research-focused workspace agent that can continuously discover, read, analyze, organize, and summarize papers for a target research direction, then push high-value outputs to WeChat.

The agent is not a general chatbot first. Its primary job is to act like a research assistant for one person or one lab.

## Product Positioning

ReAgent should be built as a `Research Workspace / Research OS`, not as a single-report generator and not as a generic chat shell with research bolted on later.

Its product center should be the closed loop of:

- `Evidence`
  - papers
  - repos
  - article links
  - citations
  - provenance
- `Memory`
  - direction briefs
  - preferences
  - previous reports
  - reusable modules
  - feedback
- `Delivery`
  - daily push
  - paper briefs
  - direction reports
  - research maps
  - meeting decks

This means chat is only one interaction surface. The more important outputs are durable research artifacts that can be reused later.

## Landscape-Derived Principles

The system should borrow these lessons from the research-agent landscape:

- prioritize end-to-end research workflows over isolated chat turns
- keep evidence, citation, provenance, and confidence visible in important outputs
- treat scholarly retrieval quality, paper-repo linking, and report structure as core capabilities
- design for long-running tasks, memory, tool orchestration, and future multi-agent expansion
- present the product as a clear workspace with reusable deliverables, not only as a demo repo
- keep local deployment, inspectability, extensibility, and operator control as product advantages

## Non-Goals

ReAgent should not drift toward:

- a generic chatbot product first
- a single-shot deep-research report product only
- a hosted black-box SaaS that hides artifacts and workflow state
- a system where chat is more central than direction reports, research maps, and knowledge assets

## Core Outcomes

The agent should help with four high-value workflows:

1. Daily discovery
   Find new and high-quality papers in target directions and push them to WeChat.

2. Deep paper analysis
   When given a paper, article, post, or link, download the paper, analyze it, and produce structured conclusions.

3. Reproducibility and implementation mining
   Check whether the paper has code, inspect the GitHub repository, and extract reusable modules or innovation points.

4. Research synthesis
   Build weekly summaries, group-meeting PPTs, baseline maps, and candidate innovation ideas for a topic.

## Primary Use Cases

### 1. Daily paper scouting

Input:

- Research directions stored in memory
- Optional keywords, preferred venues, blocked topics, preferred authors

Output:

- Daily or scheduled WeChat push
- A ranked list of new papers
- For each paper:
  - title
  - link
  - source
  - why it matters
  - novelty guess
  - relevance score
  - whether code exists

### 2. Single paper deep dive

Input:

- Paper URL
- ArXiv URL
- DOI
- Title
- A post from WeChat public account / Xiaohongshu / website mentioning a paper
- An article link that contains a paper title, project page, or GitHub link

Output:

- Downloaded paper PDF
- Parsed text, figures, and metadata
- Structured report including:
  - problem statement
  - core method
  - main innovation points
  - training/inference pipeline
  - strengths
  - weaknesses
  - likely baseline
  - possible extension points

### 3. Code and repository analysis

Input:

- Paper metadata
- Direct GitHub link
- GitHub link found from the paper itself
- GitHub link extracted from a WeChat public account / Xiaohongshu / Zhihu / blog article
- GitHub link found from web search when the article only mentions the paper title

Output:

- Whether official or unofficial code exists
- Repo quality assessment
  - stars
  - activity
  - completeness
  - reproducibility risk
- Important modules extracted from the repo
- Downloaded repository snapshot or selected modules
- Local archive of reusable code ideas

### 4. Baseline and innovation support

Input:

- A research direction
- A set of recent papers

Output:

- Baseline candidates for the direction
- Common modules used in the field
- Underexplored combinations
- Possible improvement ideas
- Candidate innovation points worth testing

### 5. Group meeting PPT generation

Input:

- Recent papers read in the last N days
- A specific topic
- A paper shortlist

Output:

- Generated PPT outline
- One slide per paper or one section per theme
- Extracted key figures / model diagrams / tables from PDFs
- Summary slides:
  - recent trends
  - common baselines
  - innovation map
  - next-step suggestions

## Memory Model

The agent should use memory as a first-class input, not as an afterthought.

### Long-term memory

Store:

- research directions
- research profile for each direction
- topic preferences
- favorite venues
- important authors/labs
- blocked topics
- preferred output style
- recurring project goals

Examples:

- "Focus on multimodal RAG for long-document understanding"
- "Prefer papers with code and strong experiments"
- "Care more about practical reusable modules than pure theory"

### Research profile

Each direction should not be stored as a single keyword string only.

It should support:

- main direction
- sub-directions
- excluded topics
- preferred datasets
- preferred benchmarks
- preferred venues
- preferred paper style
  - theory
  - engineering
  - reproducibility
  - application
- current open questions
- current project goals

This allows the agent to search and rank based on actual research intent rather than raw keywords.

### Working memory

Store:

- recent papers analyzed
- recent GitHub repos collected
- recent innovation ideas
- recent baseline comparisons
- recent PPT source materials

### Artifact memory

Store references to:

- PDFs
- parsed markdown/text
- extracted figures
- GitHub snapshots
- summary reports
- generated PPTs

## Required Agent Capabilities

### A.0 Unified research object model

The system should standardize everything into connected entities:

- `source_item`
  - an external article, post, blog, public account page, Xiaohongshu note, Zhihu page, or direct link
- `paper`
  - a normalized paper entity
- `repo`
  - a normalized GitHub repository entity
- `module_asset`
  - a reusable code module or extracted implementation idea
- `report`
  - paper report, repo report, direction report, weekly report
- `presentation_asset`
  - PPT outline, figures, final slides

This object model is critical for:

- deduplication
- linking paper to repo
- linking article to paper
- linking reports to source evidence
- reusing previous work in future summaries and PPTs

### A. Discovery

The agent should:

- read target directions from memory
- generate search queries automatically
- search recent papers regularly
- rank papers by relevance and quality
- avoid repeated pushes

Potential sources:

- arXiv
- Crossref
- Semantic Scholar
- Google Scholar-compatible sources if usable
- GitHub trending or repo search
- selected websites / blogs / social sources

### A.1 External link ingestion

The agent should:

- accept article links from WeChat public accounts, Xiaohongshu, Zhihu, blogs, and similar sites
- extract the main text and outbound links
- detect mentioned paper titles, arXiv links, DOI links, project pages, and GitHub links
- turn article content into standardized paper candidates
- use GitHub links that appear inside the article as valid repo sources, not only links provided directly by the user

### B. Reading and parsing

The agent should:

- download PDFs
- extract text
- detect title, abstract, method, experiments
- extract figures and tables when possible
- preserve links between report sections and original evidence

### C. Structured analysis

The agent should answer at least these questions for each paper:

1. What problem does the paper solve?
2. What is the main innovation?
3. What is actually new versus recombined?
4. What baseline does it beat?
5. What module is reusable?
6. What are the weaknesses or risks?
7. Is it worth following up?

### C.1 Decision layer

The agent should not stop at summary.

For each paper or repo, it should give an explicit recommendation:

- worth reading now
- worth reproducing
- worth discussing in group meeting
- worth archiving only
- low priority / ignore

This is important because the real user goal is research decision support, not just information extraction.

### C.2 Evidence and confidence

The agent should separate:

- directly supported claims from the paper
- claims supported by code evidence
- agent inference
- speculation

Important conclusions should include:

- evidence source
- confidence level
- missing evidence if any

### D. Code analysis

The agent should:

- find GitHub links from the paper, from article content, or from the web
- distinguish official vs unofficial repos
- inspect repo structure
- identify key modules
- download selected code or repo snapshots
- write reusable notes for future implementation

### E. Notification and interaction

The agent should:

- push daily results to WeChat
- accept a WeChat message like:
  - "analyze this paper"
  - "summarize today's papers"
  - "generate this week's group meeting PPT"
  - "give me baseline and possible innovation points for topic X"

### E.1 Feedback loop

The user should be able to quickly provide feedback such as:

- useful
- not useful
- more like this
- less like this
- too theoretical
- too engineering-heavy
- worth following
- not worth following

The agent should use this feedback to refine:

- ranking
- push frequency
- direction profile
- paper selection quality

## Structured Outputs

The system should standardize outputs into reusable artifact types.

### 1. Paper Brief

- title
- date
- source
- topic tags
- summary
- innovation points
- code availability
- recommendation level
- confidence

### 2. Deep Paper Report

- metadata
- source article link if the paper was discovered from an article
- paper summary
- innovation analysis
- baseline comparison
- reproducibility analysis
- code analysis
- reusable modules
- next-step suggestions
- recommendation level
- evidence references
- confidence notes

### 3. Repo Report

- repo link
- official/unofficial
- setup complexity
- important folders
- reusable modules
- extracted implementation notes

### 4. Direction Report

- direction overview
- recent representative papers
- common baselines
- common modules
- open problems
- suggested innovation routes

### 5. Group Meeting PPT Package

- ppt outline
- slide-by-slide notes
- selected figures
- citation list
- exported ppt/pptx or markdown-to-ppt source

## Scheduling

The agent should support scheduled jobs.

### Daily

- read research directions from memory
- search for new papers
- rank them
- push top results to WeChat

### On demand

- analyze a paper from a link or title
- inspect paper code repo
- generate a topic summary
- generate a PPT

### Weekly

- summarize all papers read this week
- produce topic trend analysis
- generate group-meeting materials

## Deduplication and aggregation

The system should merge repeated references to the same paper coming from:

- paper search engines
- GitHub links
- public account articles
- Xiaohongshu notes
- Zhihu posts
- blogs and websites

The goal is not to create duplicate items, but to aggregate them into one research record with multiple evidence sources.

## Task State Machine

Each workflow should have explicit states such as:

- queued
- fetching
- parsing
- normalizing
- searching-paper
- downloading-paper
- analyzing-paper
- checking-repo
- extracting-module
- generating-summary
- generating-ppt
- completed
- failed

This will make scheduled execution, retries, and UI visibility much easier.

## Suggested System Modules

### 1. Direction Manager

Responsible for:

- storing and updating research directions in memory
- turning directions into search plans

### 2. Discovery Engine

Responsible for:

- searching recent papers
- deduplicating
- ranking
- deciding what to push

### 2.1 Ranking and recommendation layer

Responsible for:

- relevance scoring
- novelty scoring
- reproducibility scoring
- recommendation classification
- push threshold control

### 3. Paper Ingestion Engine

Responsible for:

- locating paper PDF
- downloading paper
- parsing text and figures
- storing artifacts

### 4. Analysis Engine

Responsible for:

- innovation analysis
- baseline analysis
- method decomposition
- weakness detection

### 5. Repo Mining Engine

Responsible for:

- finding GitHub repo
- downloading repo or selected modules
- summarizing code structure

### 6. Synthesis Engine

Responsible for:

- multi-paper comparison
- baseline mapping
- innovation route generation
- weekly summary generation

### 6.1 Baseline Map Engine

Responsible for:

- listing common baselines in a direction
- grouping common modules and tricks
- detecting saturated idea patterns
- suggesting possible improvement routes

### 7. Presentation Engine

Responsible for:

- generating group meeting PPT outline
- selecting figures from papers
- producing slide content

### 8. WeChat Delivery Layer

Responsible for:

- scheduled pushes
- on-demand commands
- delivery confirmation

### 9. Feedback Engine

Responsible for:

- ingesting user feedback
- updating preference weights
- improving future ranking and recommendation quality

## Recommended MVP

The first usable version should focus on the shortest path to value.

### MVP Phase 1

- Save research directions in memory
- Run a daily paper search
- Rank and push top papers to WeChat
- Accept a paper link and generate a structured paper report
- Normalize article links into paper candidates

### MVP Phase 2

- Detect GitHub repos
- Download selected repos or modules
- Build a local archive of reusable code components

### MVP Phase 3

- Multi-paper comparison by direction
- Baseline and innovation suggestions
- Weekly summary report

### MVP Phase 4

- Auto-generate group-meeting PPT
- Extract figures from PDFs automatically

## Important Constraints

### Quality over volume

The agent should not flood WeChat with many low-value papers.
It should rank aggressively and push only the most relevant items.

### Decision usefulness over raw summary

The best output is not just "what this paper says".
The best output is "what the user should do with this paper".

### Evidence-backed analysis

Innovation analysis should cite the actual paper text or figure context whenever possible.

### Reproducibility awareness

The agent should distinguish:

- paper claim
- inferred novelty
- code-backed evidence
- speculation

### Reuse-oriented storage

Downloaded repos and extracted modules should be stored in a way that supports later implementation and comparison.

## Example Commands

### Daily push

- "Send me today's top 5 papers on multimodal RAG"

### Paper analysis

- "Analyze this paper: <url>"
- "Download and analyze the paper mentioned in this post"
- "Read this article, find the paper and GitHub links inside it, and standardize them"

### Repo analysis

- "Check whether this paper has official code"
- "Extract the GitHub link that appears in this article and inspect the repo"
- "Download the innovative module from this repo and save notes"

### Research synthesis

- "Give me baselines for topic X"
- "What modules are promising for improving topic X?"

### Presentation

- "Generate this week's group meeting PPT"
- "Summarize the papers read in the last 7 days into slides"

## Final Product Definition

This agent is a personal research operating system with WeChat as the main delivery channel.

Its job is to continuously:

- know what research directions matter
- discover new work
- analyze important papers deeply
- track code and reusable modules
- synthesize recent progress
- generate research materials such as summaries and PPTs

It should help move from "information overload" to "structured, reusable research insight".
