# 科研 Agent 开源项目对比

更新时间：2026-04-07  
统计口径：GitHub 官方仓库页面与 GitHub REST API `stargazers_count`

## TL;DR

如果目标是继续打磨 `ReAgent` 这类“研究工作台 / Research OS”，最值得优先研究的是：

1. [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)
2. [bytedance/deer-flow](https://github.com/bytedance/deer-flow)
3. [bytedance/pasa](https://github.com/bytedance/pasa)
4. [jmiao24/Paper2Agent](https://github.com/jmiao24/Paper2Agent)
5. [SalesforceAIResearch/enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
6. [InternScience/InternAgent](https://github.com/InternScience/InternAgent)

判断标准不是只看 star，而是看这几个维度是否对 `ReAgent` 真有借鉴价值：

- 是否围绕“研究任务闭环”而不是单纯聊天
- 是否有 evidence / citation / provenance 设计
- 是否有 report / deliverable 输出
- 是否体现多 agent、记忆、工具链、长任务编排
- 是否具备产品化 UI 或至少有清晰的工作流结构

## 快速表

| 项目 | Stars | 语言 | 更偏什么 | 对 ReAgent 最值得学 |
| --- | ---: | --- | --- | --- |
| [gpt-researcher](https://github.com/assafelovic/gpt-researcher) | 26,267 | Python | 通用 deep research agent | 报告流、citation、agent 工作流、产品表达 |
| [deer-flow](https://github.com/bytedance/deer-flow) | 58,769 | Python | 超级 agent / 长任务编排 | 多 agent harness、memory、skills、sandbox、产品气质 |
| [pasa](https://github.com/bytedance/pasa) | 1,553 | Python | 论文搜索 agent | scholarly search、选文策略、paper retrieval agent |
| [local-deep-researcher](https://github.com/langchain-ai/local-deep-researcher) | 9,013 | Python | 本地化 deep research | 本地部署、研究报告闭环、轻量工程化 |
| [node-DeepResearch](https://github.com/jina-ai/node-DeepResearch) | 5,143 | TypeScript | 搜索-阅读-推理循环 | TS 实现、最小闭环、网页 research loop |
| [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research) | 1,151 | Python | 企业级 deep research | 企业知识源、multi-agent orchestration、UI 思路 |
| [Paper2Agent](https://github.com/jmiao24/Paper2Agent) | 2,159 | Jupyter Notebook | 论文转 agent | “论文 -> agent” 产品方向，非常适合启发研究型产品 |
| [OpenResearcher](https://github.com/GAIR-NLP/OpenResearcher) | 503 | HTML | 科研助手 | 科研定位明确，但成熟度和活跃度一般 |
| [InternAgent](https://github.com/InternScience/InternAgent) | 1,268 | Python | 科学发现 agent 框架 | 长周期 scientific discovery、科研自动化闭环 |
| [Denario](https://github.com/AstroPilot-AI/Denario) | 547 | TeX | 科学研究多 agent | 科学研究编排视角，适合看问题拆解和系统边界 |

## 项目分组

### 1. 更像“Research OS / Deep Research 产品”

#### [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)

- 适合研究：研究报告生成、引用与证据组织、agent research 流程
- 值得借鉴：
  - 从 query 到 report 的完整产品路径
  - deep research 的输出组织方式
  - 如何把“研究 agent”包装成比较清晰的产品能力
- 对 `ReAgent` 的价值：
  - 报告页结构
  - evidence/citation 展示
  - 产品描述方式

#### [bytedance/deer-flow](https://github.com/bytedance/deer-flow)

- 适合研究：多 agent 编排、长任务执行、工具系统、memory 与 sandbox
- 值得借鉴：
  - 超级 agent 的系统分层
  - skill / tool / memory / subagent 的组合方式
  - 很强的产品表达和项目包装
- 对 `ReAgent` 的价值：
  - 架构层面的 agent harness
  - 产品官网 / 控制台的表达方式
  - 长时任务与多角色协作设计
- 注意：
  - 它不是纯科研 agent，而是更大的 super-agent 框架

#### [langchain-ai/local-deep-researcher](https://github.com/langchain-ai/local-deep-researcher)

- 适合研究：本地 deep research 闭环
- 值得借鉴：
  - 本地模型 / 本地工作流的产品定位
  - 轻量级报告流
- 对 `ReAgent` 的价值：
  - 本地部署叙事
  - 隐私与可控性的卖点表达

#### [jina-ai/node-DeepResearch](https://github.com/jina-ai/node-DeepResearch)

- 适合研究：TypeScript 风格的 research loop
- 值得借鉴：
  - 搜索 -> 阅读 -> 推理 的最小闭环
  - TS/Node 环境下的实现
- 对 `ReAgent` 的价值：
  - 前后端技术栈相近
  - 适合参考最小可解释 research agent 结构

#### [SalesforceAIResearch/enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)

- 适合研究：企业研究、知识源接入、multi-agent
- 值得借鉴：
  - enterprise deep research 的 UI 与系统边界
  - 企业知识接入视角
- 对 `ReAgent` 的价值：
  - 如果未来强调“团队研究工作台”，这个项目很值得看

### 2. 更像“学术检索 / 论文研究 agent”

#### [bytedance/pasa](https://github.com/bytedance/pasa)

- 适合研究：复杂 scholarly query 的 paper search
- 值得借鉴：
  - 论文搜索策略
  - 检索、筛选、阅读、引用选择的 agent 决策
- 对 `ReAgent` 的价值：
  - 论文发现质量
  - research run 的检索策略设计

#### [GAIR-NLP/OpenResearcher](https://github.com/GAIR-NLP/OpenResearcher)

- 适合研究：科学研究助手定位
- 值得借鉴：
  - 科研场景如何被表述
- 对 `ReAgent` 的价值：
  - 更像学术助理而非泛用 agent 的 framing
- 注意：
  - star 和活跃度相对弱，参考价值更多在方向，不在工程成熟度

### 3. 更像“科学发现 / 研究自动化系统”

#### [InternScience/InternAgent](https://github.com/InternScience/InternAgent)

- 适合研究：long-horizon scientific discovery
- 值得借鉴：
  - 科学研究任务的长期编排
  - “统一科研 agent 框架”的边界设计
- 对 `ReAgent` 的价值：
  - 如果未来从研究工作台继续扩展到“自动化科学发现”，它是必看项目

#### [AstroPilot-AI/Denario](https://github.com/AstroPilot-AI/Denario)

- 适合研究：模块化 scientific research assistance
- 值得借鉴：
  - 科学研究任务的模块化拆分
- 对 `ReAgent` 的价值：
  - 研究助手角色拆分
  - 多 agent 在科研中的职责边界

### 4. 更像“论文 -> agent”的新方向

#### [jmiao24/Paper2Agent](https://github.com/jmiao24/Paper2Agent)

- 适合研究：如何把论文变成可交互 agent
- 值得借鉴：
  - 从“研究内容”直接生成“可用 agent”的产品思路
- 对 `ReAgent` 的价值：
  - 非常适合启发 `direction report -> reusable agent` 或 `paper report -> specialized tool` 这条线

## 对 ReAgent 最值得抄的点

### 抄工作流

- `gpt-researcher`
- `pasa`
- `enterprise-deep-research`

原因：

- 都比较强调从问题到报告的研究闭环
- 不只是聊天，而是面向 research task

### 抄架构

- `deer-flow`
- `InternAgent`
- `local-deep-researcher`

原因：

- 对长任务、memory、tools、subagents 的组织更清楚
- 更适合做 `ReAgent` 未来的系统演进参考

### 抄产品表达 / 官网叙事

- `deer-flow`
- `gpt-researcher`
- `enterprise-deep-research`

原因：

- 它们更像“产品”，不是纯 demo repo
- 很适合参考如何把 agent 能力包装成用户能一眼理解的价值

### 抄科研定位

- `pasa`
- `OpenResearcher`
- `InternAgent`
- `Denario`

原因：

- 这些项目的“科研味”更强
- 更接近 `ReAgent` 想强调的研究工作台定位

## 如果只看 5 个

如果时间有限，只看下面这 5 个就够：

1. [gpt-researcher](https://github.com/assafelovic/gpt-researcher)
2. [deer-flow](https://github.com/bytedance/deer-flow)
3. [pasa](https://github.com/bytedance/pasa)
4. [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
5. [InternAgent](https://github.com/InternScience/InternAgent)

## 对 ReAgent 的直接建议

基于这些项目，`ReAgent` 最有机会打出的差异点不是“我也能做 deep research”，而是：

- `Research Workspace`，不是单个 research agent
- `Evidence + Memory + Delivery` 三者打通
- `方向报告 / 研究地图 / 知识库` 明显比纯聊天更中心
- 本地可控、可改、可扩展，而不是单一托管 SaaS

也就是说，`ReAgent` 最适合走的不是 `GPT Researcher` 的单报告产品路线，而是：

**ReAgent = 面向持续研究工作的 Research OS**

## 推荐学习顺序

如果目的是“学习开源科研 agent 并转化成 ReAgent 的路线”，推荐按下面顺序看：

### 第一轮：先看产品闭环和用户看到的价值

1. `gpt-researcher`
2. `deer-flow`
3. `enterprise-deep-research`

重点看：

- 首页 / README 如何定义产品
- 输入是什么：query、brief、workspace 还是 task
- 输出是什么：report、workspace、artifact 还是 chat
- citation / evidence / provenance 是怎么露出来的

### 第二轮：再看检索质量和研究输入

1. `pasa`
2. `node-DeepResearch`
3. `local-deep-researcher`

重点看：

- query 是怎么生成的
- paper candidate 是怎么筛的
- article / link / paper / repo 之间怎么串起来
- 最小可解释 research loop 是什么

### 第三轮：再看长任务和 agent harness

1. `deer-flow`
2. `InternAgent`
3. `Denario`

重点看：

- memory / tool / skill / role 如何分层
- 长任务如何表达状态、阶段、handoff
- 多 agent 是不是在解决真实问题，而不是只是在堆架构

### 第四轮：最后看新方向

1. `Paper2Agent`
2. `AI-Scientist-v2`

重点看：

- 怎么把研究结果继续变成 agent / tool / reusable artifact
- ideation / novelty / branch search 适合放在 ReAgent 的哪个阶段
- 哪些能力必须晚一点再抄，避免把系统过早带到实验执行

## 映射到 ReAgent 的近期实施顺序

如果按“先学开源科研 agent，再落到 ReAgent”来排，近期最该做的是：

1. `Research Brief`
   - 对应借鉴：`gpt-researcher`、`pasa`
   - 原因：先把研究输入结构化，后面的检索和报告才会变强
2. `Discovery Quality + Source Normalization`
   - 对应借鉴：`pasa`、`node-DeepResearch`
   - 原因：先把找论文、找 repo、去重、排序做对
3. `Evidence-Backed Report + Delivery`
   - 对应借鉴：`gpt-researcher`、`enterprise-deep-research`
   - 原因：先把输出做成真正可复用的研究交付物
4. `Artifact Workspace + Retrieval`
   - 对应借鉴：`enterprise-deep-research`、`deer-flow`
   - 原因：Research Workspace 的核心是“之前做过的事还在”
5. `Entry-Aware Runtime + Toolset Boundary`
   - 对应借鉴：`deer-flow`
   - 原因：不同入口不该拥有同一套能力边界
6. `Paper -> Agent / Reusable Module`
   - 对应借鉴：`Paper2Agent`
   - 原因：这是 ReAgent 很有机会做出差异化的一条线

这些做好之后，再往后加：

- idea generation
- novelty gate
- branch-based search
- sandboxed experiment execution

## 数据来源

- [gpt-researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [pasa](https://github.com/bytedance/pasa)
- [local-deep-researcher](https://github.com/langchain-ai/local-deep-researcher)
- [node-DeepResearch](https://github.com/jina-ai/node-DeepResearch)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [OpenResearcher](https://github.com/GAIR-NLP/OpenResearcher)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [Denario](https://github.com/AstroPilot-AI/Denario)
