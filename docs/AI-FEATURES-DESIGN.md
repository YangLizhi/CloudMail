# AI 能力补齐设计文档（CloudMail）

> 范围：补齐与 Outlook Copilot 对照中的缺失项（跨应用协作明确不做）。
> 原则：每项先分析现状，再给出设计；全部实现均位于前端 TS 层，不修改 Rust 侧；
> 设置类配置继续落盘 cloudmail-settings.json，对话/操作类数据与邮件库解耦，避免 DB 锁与长写入。

## 现状盘点（证据）

- AI 基础设施：src/services/ai/ 已具备 provider 抽象（claude/openai/gemini/ollama/copilot/custom）、complete() 非流式调用、isAiAvailable()、AI 缓存。
- 已有 AI 能力：线程摘要、上下文回复、写信、改写（improve/shorten/formalize）、智能回复（3 条）、Ask Inbox（本地 FTS 搜索 + 引用回答）、AI 分类、智能标签、任务提取、写作风格模仿。
- 已有可复用基础设施：
  - 邮件动作 src/services/emailActions.ts + quickSteps/executor.ts（多线程批量动作编排）；
  - 日历 src/services/calendar/*（Google API + CalDAV，provider 工厂、calendar_events 表、事件增删查）；
  - 附件 src/services/db/attachments.ts + attachments/cacheManager.ts（本地缓存文件）；
  - 定时任务 src/services/backgroundCheckers.ts（createBackgroundChecker）；
  - 设置 src/services/db/settings.ts（cloudmail-settings.json 分级落盘 + 加密敏感项）；
  - i18n src/i18n/（zhCN + zhCNExtra 字典，MutationObserver 文本替换）。
- 布局：ThreadView 右侧已有 ContactSidebar / TaskSidebar 两种侧栏模式，可直接仿照加入 AI 对话侧栏。

## 缺失项清单与设计

### 1. AI 对话窗口（右侧面板）—— 本次重点

**分析**：当前 AI 能力都是“单次动作”（点按钮出一段结果），没有多轮对话、没有围绕某封邮件连续追问、没有把多封邮件/附件组合进同一上下文的入口。Ask Inbox 是模态弹窗且不保留会话。

**设计**：
- 位置：ThreadView 右侧新增 AiChatSidebar，与 Contact/Task 侧栏并列，ActionBar 增加 Sparkles 开关按钮（持久化 ai_chat_visible 到 settings.json）。
- 会话模型（内存 Zustand + 本地 JSON 落盘 cloudmail-chat.json，与邮件库彻底解耦）：
  - session { id, title, createdAt, updatedAt, messages };
  - ChatMessage { role, content, contextRefs?, kind? };
  - 落盘采用防抖（800ms），文件在 AppData，保留最近 20 个会话。
- 上下文机制：
  - 跟随当前邮件开关（默认开）：打开邮件变化时，自动把当前线程设为默认上下文；关闭后保持手动引用集合。
  - 引用邮件按钮 → 邮件引用选择器（复用 FTS searchMessages + getMessagesForThread）：搜索并多选邮件加入上下文，chips 展示，可移除。
  - 引用附件按钮 → 附件选择器（当前线程附件 + 附件库搜索），支持附件问答（见第 4 项）。
- 多轮对话：system prompt 固定角色与安全边界；历史 + 上下文（当前邮件/引用邮件正文截断 6000 字符/封）调 provider；loading 态展示。
- 快捷动作（一次性指令）：总结此邮件 / 提取任务 / 建议回复 / 润色此邮件 / 总结附件。
- 工具卡片：assistant 返回中包含 [[VELO_PLAN]] / [[VELO_MEETING]] / [[VELO_BRIEFING]] JSON 块时渲染结构化卡片（操作确认、会议建议、简报预览），解析失败退回纯文本。
- i18n：所有新增文案进 zhCNExtra（中）与组件内英文原文（英）。

### 2. AI 一句话批量操作（Agentic 收件箱整理）

**分析**：Quick Steps 是“用户手工配置的多步宏”，不能理解自然语言。emailActions + quickSteps executor 已具备批量执行能力，缺的是“自然语言 → 目标筛选 + 动作序列 + 用户确认”。

**设计**：
- src/services/ai/agenticActions.ts：
  - planAgenticAction(instruction, accountId)：AI 输出严格 JSON { query, actions, description }；
  - type 白名单：archive/trash/markRead/markUnread/star/unstar/applyLabel/removeLabel/moveToCategory/spam/snooze；
  - query 复用现有搜索语法筛选目标线程。
  - resolveTargetThreads(query)：searchMessages 结果映射 thread_id 去重，上限 100 封。
  - executePlan(plan, threadIds)：逐线程顺序执行（失败不中断，统计成功/失败），结束后触发列表刷新。
- UI：聊天中出现 [[VELO_PLAN]] 卡片 → 显示将影响 N 封邮件 + 动作清单 + 目标预览 + 执行/取消。必须用户确认后才执行。
- 安全：动作类型白名单；参数缺失报错；异常整卡报错，不部分静默。

### 3. AI 会议排程 / 日历问答 / 会议简报

**分析**：日历只有“手动创建事件 + 列表查看”，缺“找空闲时间”“自然语言查日历”“会前简报”。calendar_events 已同步本地，getCalendarProvider 可创建事件。

**设计**（src/services/ai/meetingService.ts）：
- suggestMeetingTimes：取窗口内已有事件 → 忙时段 + 用户要求 + 本地时区交 AI → 返回 3~5 候选 JSON；客户端再次校验不与已有事件重叠。
- createMeetingFromSuggestion：经 getCalendarProvider 在默认日历创建事件。
- answerCalendarQuestion：取未来 14 天事件摘要，AI 回答并附事件引用。
- generateMeetingBriefing：按参与者 + 主题关键词搜索相关邮件，与事件信息生成议程/会前简报。
- UI：聊天中识别“安排/开会/预约”意图 → [[VELO_MEETING]] 卡片（候选时段 + 原因 + 创建会议确认）；日历 EventDetailModal 增加“生成会议简报”按钮。
- 无日历账号/未配置时给出明确提示。

### 4. 附件/文档级 AI 问答

**分析**：附件只能浏览/下载/缓存，无内容读取与 AI 分析。缓存文件无扩展名，需按 DB 的 mime/filename 判断类型。不新增 npm 依赖（保持构建环境稳定）。

**设计**（src/services/ai/attachmentQa.ts）：
- extractText(attachment)：text/plain、html、markdown、csv、json、xml 直接解码；docx 走极简 ZIP 解析 + DecompressionStream 解压 document.xml 取文本；pdf 尝试扫描未压缩文本流；其他返回不支持。截断 8000 字符。
- summarizeAttachment / askAboutAttachment：附件文本作 context 调 provider。
- UI：附件引用 chip 可总结或直接提问；选择器标注可解析类型。

### 5. 外出自动回复（Out-of-office）

**分析**：无自动回复。发送链路已具备（buildRawEmail + provider.sendMessage）。需实现“规则激活窗口内，对每个发件人只回复一次”并防自回复。

**设计**（src/services/autoreply/）：
- 规则存储：settings.json autoReply 段 JSON 字段：auto_reply_rules（窗口、主题、正文、启用）+ auto_reply_sent（每规则每发件人已回复时间，上限 500）。
- autoReplyManager：createBackgroundChecker("AutoReply", check, 60_000)，App 启动时 start/stop。
- check()：取活跃规则 → 查本地 INBOX 非本人新邮件 → 过滤已回复发件人 → 构造 Re 回复（in-reply-to 原消息）→ sendEmail → 登记；出错只记日志。
- UI：Settings 新增“自动回复”分区：规则卡片（启用、开始/结束、主题、正文、保存/删除、已回复统计）、立即停用所有。

## 依赖关系与实施顺序

1. 对话基础设施（store/持久化/context/UI/i18n）—— 其他功能的载体；
2. 批量操作（依赖 1 工具卡片 + emailActions）；
3. 会议排程/日历问答/简报（依赖 1 工具卡片 + calendar provider）；
4. 附件问答（依赖 1 引用体系 + 附件缓存）；
5. 外出自动回复（独立后台 + Settings UI）。

## 验证方式

- npm run build（tsc 严格模式 + vite build）通过；
- npm run tauri build 产出 NSIS 安装包；
- 运行时冒烟：聊天面板开关、跟随邮件上下文、引用邮件、计划确认执行、会议建议创建、简报生成、附件总结、自动回复开关。

## 实施记录（第二轮确认后）

已确认决策：会话级临时模型切换；技能=指令包+能力声明（不执行任意代码）；市场=内置目录兜底+可配远程 catalog URL；模型探测只针对当前选中 provider。

### 1. 输出语言跟随界面语言
- chatService 的 system prompt 由固定字符串改为 `buildSystemPrompt()`，按 `getUiLanguage()` 注入 “respond in Chinese (Simplified)/English”，优先级高于输入语言（除非用户显式要求其他语言）。

### 2. 模型探测（设置-AI）
- `AiProviderClient` 新增 `listModels()`；六类 provider 全部实现：
  - custom/openai/ollama/copilot → OpenAI SDK `models.list()`；
  - claude → Anthropic SDK `models.list()`；
  - gemini → REST `GET /v1beta/models`（仅 generateContent 模型）；
  - 失败返回空数组，UI 回退内置 `PROVIDER_MODELS` 并提示。
- `providerManager.listModels()` + `getActiveProvider(overrideModel?)`（cache key 含 model）。
- `modelCatalog.ts`：`<provider>_models_cache`（JSON {at, models}）读写；`getModelsForProvider()` 缓存优先、静态兜底。
- 设置-AI：三个 Test Connection 入口在连接成功后自动探测；新增 “Models” 区块：默认模型下拉（探测列表/静态列表）+ 候选列表（搜索、设为默认）+ 来源徽标（probed/cached/built-in）+ 失败提示。

### 3. 对话内联动选模型
- `ChatSession.modelOverride` 会话级覆盖；AiChatSidebar 顶部新增 Model 下拉（默认=跟随设置），切换仅影响当前会话并持久化到 cloudmail-chat.json；聊天请求经 `getActiveProvider(modelOverride)` 即时生效。

### 4. 技能 + 插件市场
- `skills/types.ts` Skill 结构（id/name/version/description/author/homepage/instructions/tools/risk/builtin/enabled）。
- `skillManager.ts`：内置 5 个技能（Inbox Triage/Meeting Prep/Inbox Zero/Writing Polish/Task Extractor）；安装/卸载/启停；`fetchRemoteCatalog()` 走 `@tauri-apps/plugin-http`（规避 WebView CSP，与自定义 AI 同通道）。
- 设置-AI 新增 “Skills” 与 “Plugin Marketplace” 区块：技能启停/卸载、风险徽标、目录 URL（内置目录兜底）+ 安装。
- AiChatSidebar 新增技能 chips（会话级启用），选中技能注入 system prompt。
