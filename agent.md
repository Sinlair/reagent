# ReAgent Agent Blueprint

## 1. 一句话定义

ReAgent 不是一个“带研究按钮的聊天机器人”，而是一个本地优先、可持续运行的 `Research Workspace / Research OS`。

它的任务是围绕明确的研究方向，持续完成：

- 发现新论文与相关来源
- 标准化论文、文章、仓库和证据
- 产出有判断的研究报告
- 提取可复用模块与实现线索
- 生成周报、baseline map、组会 PPT
- 通过 Web / WeChat / OpenClaw 等渠道稳定交付
- 把反馈与结果写回记忆，驱动下一轮研究

## 2. 为什么要参考开源项目

ReAgent 不应该闭门造车。

当前开源研究 agent 领域已经出现了几条很明确的路线：

- 深度研究报告路线
- 长任务工作台路线
- 学术检索优化路线
- 多智能体企业分析路线
- 论文到工具 / Agent 的转译路线
- 自动科学发现路线

ReAgent 的合理做法不是复制其中任何一个项目，而是基于这些项目提炼出适合自身的产品边界和技术优先级。

## 3. 开源参考系

### 3.1 [GPT Researcher](https://github.com/assafelovic/gpt-researcher)

可借鉴点：

- 把“深度研究”定义为标准工作流，而不是一次普通对话
- 以 `planner -> execution -> publisher` 的结构组织研究过程
- 报告必须强调 citation、source tracking 和可追溯性
- 支持 web research 与 local research 的统一输出
- 深度研究可以用树状探索，而不是线性搜索

对 ReAgent 的启发：

- ReAgent 的核心输出必须是高质量研究工件，而不是随手生成的回答
- 报告结构、证据引用、来源追踪应该是默认能力
- 对方向研究，应该支持“广度发现 + 深度下钻”的混合流程

### 3.2 [DeerFlow](https://github.com/bytedance/deer-flow)

可借鉴点：

- 把 agent 设计成 long-horizon harness，而不是单轮助手
- memory、tools、skills、subagents、gateway 都是一等公民
- 任务可能持续分钟到小时，因此状态可见性非常重要
- 本地部署、可控权限、可观测性是产品能力，不是附属功能

对 ReAgent 的启发：

- ReAgent 应该是一个长期运行的工作台，而不是只重视“问答体验”
- 研究任务需要显式状态、审计、恢复和计划执行
- 记忆、技能、渠道接入和运行时边界要明确，而不是混在 prompt 里
- 本地可信环境与可观测运行是核心优势

### 3.3 [PaSa](https://github.com/bytedance/pasa)

可借鉴点：

- 学术检索本身就是核心问题，不是搜索 API 的简单包装
- 论文搜索需要连续决策：调用搜索工具、阅读论文、筛参考文献、扩展检索
- 检索质量决定后续报告质量

对 ReAgent 的启发：

- ReAgent 必须把 paper discovery 和 academic retrieval 放在核心能力里
- “找什么、为什么找、是否继续扩展引用链” 应该是显式决策
- 研究方向的 brief 需要直接驱动检索策略，而不是只当标签

### 3.4 [Enterprise Deep Research](https://github.com/SalesforceAIResearch/enterprise-deep-research)

可借鉴点：

- 用 master planning agent 做查询拆解
- 用专门的 search agents 分别处理通用搜索、学术搜索、GitHub 搜索等
- reflection 机制用于发现知识缺口并修正方向
- human-in-the-loop steering 能在长任务中随时纠偏
- progress tracking、streaming、benchmarking 是产品级能力

对 ReAgent 的启发：

- ReAgent 需要把任务拆解、专用搜索角色、反思环路和人工纠偏纳入设计
- 工作台里必须能看到任务进展，而不是只看到最终结果
- 如果以后做多智能体，必须是为了提高清晰度和吞吐，而不是为了“看起来高级”

### 3.5 [Paper2Agent](https://github.com/jmiao24/Paper2Agent)

可借鉴点：

- 强论文不仅能被总结，还能被转成可交互工具或专用 agent
- 从论文 / repo 中抽取 MCP server、tool、测试、质量报告是一条可复用路径
- 研究结果最终可以进入“可操作资产层”

对 ReAgent 的启发：

- ReAgent 不应停在“读完论文就结束”
- 对高价值论文，后续应支持抽取模块、工具草案、可复现实验入口
- `module_asset` 应该成为正式对象，而不是报告里的附带段落

### 3.6 [InternAgent](https://github.com/InternScience/InternAgent)

可借鉴点：

- 长周期科学发现可以拆成 `Generation -> Verification -> Evolution`
- 文献分析、知识综合、假设构建、验证与长期记忆应该形成统一系统
- 多源知识整合比单纯网页总结更接近真实科研工作

对 ReAgent 的启发：

- ReAgent 的定位应该是“研究循环系统”，不是“研究摘要器”
- 方向研究不能只停留在阅读，还要支持验证导向的下一步建议
- 记忆应服务于后续研究演进，而不是只存聊天历史

### 3.7 [AI Scientist-v2](https://github.com/SakanaAI/AI-Scientist-v2)

可借鉴点：

- 自动科学发现可以延伸到假设生成、实验执行、结果分析和论文写作
- 树搜索对复杂研究路径探索有效

对 ReAgent 的启发：

- ideation、novelty gate、自动实验是后期可扩展方向
- 这些能力不能早于基础工作台、检索、证据链和工件系统

## 4. 参考这些项目后，ReAgent 的产品结论

### 4.1 产品中心必须是“研究闭环”，不是聊天

ReAgent 的主线应该是：

`Research Brief -> Discovery -> Normalize -> Analyze -> Synthesize -> Deliver -> Feedback -> Memory`

而不是：

`Chat -> More Chat -> Longer Chat`

### 4.2 最重要的不是“能回答”，而是“能交付”

ReAgent 最有价值的输出应是：

- daily brief
- paper brief
- deep paper report
- repo report
- direction report
- baseline map
- weekly summary
- group meeting deck

聊天只是入口之一，不是产品本体。

### 4.3 最重要的不是“搜到很多”，而是“筛出值得处理的”

从 PaSa 和 GPT Researcher 可以看出，研究系统真正有价值的地方在于：

- 查询生成
- 检索扩展
- 结果筛选
- 证据组织
- 结论生成

因此 ReAgent 应优先提高 discovery quality，而不是堆更多来源。

### 4.4 多智能体是手段，不是目标

从 DeerFlow、Enterprise Deep Research、InternAgent 看，多智能体只有在这些场景里才值得引入：

- 长任务拆解
- 不同来源的专门检索
- 反思与纠偏
- 结果汇总与工件生产

如果没有明确角色边界，多智能体只会增加复杂度。

## 5. ReAgent 的目标产品形态

ReAgent 应该被建设为一个本地研究工作台，围绕下面三层展开。

### 5.1 Evidence Layer

管理研究证据：

- 论文
- PDF
- 文章链接
- GitHub 仓库
- 引用链
- 证据片段
- 图表

### 5.2 Memory Layer

管理长期上下文：

- research brief
- 用户偏好
- 历史报告
- baseline 对比
- 复用模块
- 反馈记录

### 5.3 Delivery Layer

管理稳定交付：

- Web 工作台
- WeChat 推送
- OpenClaw 插件
- 日报 / 周报
- 组会材料

## 6. 核心对象模型

参考 GPT Researcher、Paper2Agent、Enterprise Deep Research 之后，ReAgent 应统一使用以下对象：

### `ResearchBrief`

描述一个研究方向的目标、约束、评估标准和交付偏好。

至少包含：

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

表示外部来源项，例如：

- 微信公众号文章
- 小红书笔记
- 知乎回答
- 博客文章
- 项目页
- arXiv 页面
- DOI 页面

### `Paper`

规范化后的论文实体，关联：

- metadata
- PDF
- 来源入口
- 引用信息
- 相关方向
- 结论摘要
- 证据索引

### `Repo`

规范化后的仓库实体，关联：

- official / unofficial
- stars / activity
- setup complexity
- important folders
- reproducibility risk

### `ModuleAsset`

从 repo 中抽取出的可复用模块、代码思路、工程技巧或工具草案。

### `Report`

统一表示：

- paper brief
- deep paper report
- repo report
- direction report
- weekly report

### `PresentationAsset`

统一表示：

- PPT outline
- slide notes
- figures
- final deck

### `Feedback`

表示用户对结果的显式反馈，用于影响排序、推送阈值和方向画像。

### `ResearchRound`

表示一轮完整研究活动，串联：

- brief
- discovery candidates
- selected papers
- reports
- decisions
- delivery outputs

## 7. ReAgent 的核心工作流

### 7.1 Brief-Driven Discovery

参考 PaSa，ReAgent 的 discovery 不能是固定关键词搜索，而应该由 brief 驱动。

系统需要：

- 基于 brief 自动生成查询
- 根据目标问题扩展相关查询
- 搜最近论文
- 搜项目页和 GitHub 仓库
- 对候选进行相关性和价值排序
- 对重复候选做聚合

### 7.2 Article-To-Paper Normalization

参考真实研究场景，用户经常发来的是文章，而不是 arXiv 链接。

因此系统要能从文章中识别：

- 论文标题
- arXiv / DOI
- 项目页
- GitHub 链接
- 对论文的描述语句

并把这些入口合并为一个标准 `paper candidate`。

### 7.3 Evidence-Backed Paper Analysis

参考 GPT Researcher，输出不能只是泛化摘要。

每篇论文至少要回答：

1. 解决什么问题
2. 核心方法是什么
3. 真正的新意是什么
4. 与哪些 baseline 对比
5. 哪些模块可以复用
6. 风险、缺点和不确定性是什么
7. 是否值得进一步行动

### 7.4 Repo Mining

参考 Paper2Agent，代码仓库分析应该是正式能力。

系统要能：

- 查找官方 / 非官方仓库
- 分析目录结构
- 识别关键模块
- 判断复现成本
- 保存仓库快照或选定模块
- 形成 module notes

### 7.5 Synthesis

参考 GPT Researcher、InternAgent、Enterprise Deep Research，ReAgent 必须支持多论文综合：

- baseline map
- representative paper set
- common modules
- trend summary
- candidate innovation routes
- meeting deck

### 7.6 Feedback And Iteration

参考 DeerFlow 和 Enterprise Deep Research，长任务不能没有纠偏入口。

用户应该能快速表达：

- 有用 / 没用
- 多一点 / 少一点
- 太理论 / 太工程
- 值得跟 / 先忽略

系统据此更新：

- 排序策略
- 推送策略
- brief 画像
- 下一轮探索重点

## 8. 结构化输出

### 8.1 Daily Paper Brief

至少包含：

- 标题
- 来源
- 日期
- relevance reason
- novelty guess
- code availability
- recommendation level

### 8.2 Deep Paper Report

至少包含：

- 元数据
- 来源链
- 问题定义
- 方法结构
- 创新点
- baseline 对比
- 优势与弱点
- repo 情况
- 可复用模块
- 下一步建议
- 证据引用
- 置信度

### 8.3 Repo Report

至少包含：

- 仓库链接
- 官方性判断
- 活跃度
- 关键目录
- 复现复杂度
- 关键模块
- 风险说明

### 8.4 Direction Report

至少包含：

- 方向概览
- 代表论文
- baseline map
- common modules
- underexplored combinations
- possible next steps

### 8.5 Group Meeting Deck Package

至少包含：

- 组会大纲
- 按页说明
- 关键图表
- 引用列表
- 最终导出文件或源文件

## 9. 任务状态机

参考 DeerFlow 和 Enterprise Deep Research，ReAgent 的任务必须可见、可恢复、可重试。

建议状态至少包括：

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

## 10. 系统模块建议

### 10.1 Brief Manager

负责管理研究方向、研究 brief 和用户偏好。

### 10.2 Discovery Engine

负责查询生成、来源拉取、候选聚合和初步排序。

### 10.3 Ranking Layer

负责：

- relevance scoring
- novelty estimation
- reproducibility scoring
- recommendation classification

### 10.4 Ingestion Engine

负责：

- 下载 PDF
- 解析正文
- 提取图表
- 标记证据位置

### 10.5 Analysis Engine

负责：

- 方法分析
- baseline 分析
- 弱点识别
- 证据与推断分层

### 10.6 Repo Mining Engine

负责：

- repo 搜索
- officiality 判定
- 关键模块提取
- module asset 生成

### 10.7 Synthesis Engine

负责：

- 多论文对比
- 方向级总结
- 周报
- 组会材料

### 10.8 Delivery Layer

负责：

- Web 展示
- WeChat 推送
- OpenClaw 接入
- 导出与通知

### 10.9 Feedback Engine

负责：

- 记录反馈
- 调整排序
- 更新 brief 画像
- 驱动下一轮研究

## 11. MVP 优先级

综合开源参考项目后，ReAgent 当前最应该优先做的是：

### P0

- 结构化 `Research Brief`
- brief 驱动的 discovery
- `article -> paper -> repo` 归一化
- 证据驱动的 deep paper report
- WeChat 日推送

### P1

- repo mining
- module asset 提取
- direction report
- weekly summary
- group meeting PPT outline

### P2

- specialized sub-agents
- steering / reflection
- artifact retrieval
- OpenClaw parity

### P3

- paper-to-agent / MCP 转译
- ideation
- novelty gate
- 自动实验执行

## 12. 明确的非目标

ReAgent 当前不应优先做成：

- 通用聊天产品
- 只会写一份长报告的 deep research 工具
- 以实验自动执行为主的 AI Scientist
- 没有工件层和记忆层的 prompt shell

## 13. 关键产品原则

### 13.1 质量优先于数量

宁可每天少推几篇，也不要把低相关论文塞满渠道。

### 13.2 判断优先于复述

用户真正需要的是“该怎么处理这篇论文”，而不是更长的摘要。

### 13.3 证据优先于文风

结论要明确区分：

- 论文直接支持
- 代码证据支持
- agent 推断
- 明确猜测

### 13.4 工件优先于聊天记录

真正有价值的是可复用工件，而不是一长串历史对话。

### 13.5 本地可控优先于黑盒自动化

部署、权限、状态、记忆和工件都应该尽量可检查、可干预、可恢复。

## 14. 最终定义

ReAgent 的目标是把“持续科研”做成一套可运行、可追踪、可积累的工作流系统。

它最终应该帮助用户：

- 知道什么方向值得跟
- 快速发现高价值论文
- 用证据支撑研究判断
- 找到可复用模块和实现入口
- 生成周报和组会材料
- 把所有结果沉淀成下一轮研究输入

如果用户在使用 ReAgent 后，逐步从“信息过载”走向“有证据的研究决策 + 可复用工件”，那么这个产品方向就是对的。
