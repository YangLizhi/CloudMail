<p align="center">
  <img src="assets/icon.png" alt="CloudMail" width="64" height="64" style="border-radius: 24px;" />
</p>

<h1 align="center">CloudMail</h1>

<p align="center">
  <strong>本地优先 · 隐私安全 · AI 增强的桌面邮件客户端</strong><br />
  <em>Email at the speed of thought.</em>
  <br />Version <strong>0.5.2</strong> · 2026-08-27
</p>

<p align="center">
  基于 Tauri v2 + React + Rust 构建（原 Velo 项目更名升级），支持 Gmail / IMAP / SMTP，内置 AI 助手、技能系统、会议排程与自动回复。
</p>

<p align="center">
  <a href="#功能总览">功能总览</a> · <a href="#使用介绍">使用介绍</a> · <a href="#安装">安装</a> · <a href="#从源码构建">从源码构建</a> · <a href="#数据与隐私">数据与隐私</a> · <a href="#技术栈">技术栈</a> · <a href="#开源协议">开源协议</a>
</p>

---

## 为什么选择 CloudMail

- **本地优先**：邮件全部存储在本地 SQLite 数据库，无中间服务器，离线也能读邮件。
- **键盘驱动**：大量快捷键让你不用鼠标也能快速处理邮件。
- **AI 增强**：对话式 AI 助手、邮件摘要、智能回复、任务提取、会议排程、附件问答……且模型、技能都可自定义。
- **原生性能**：Rust 后端（Tauri v2），体积小、内存占用低、启动快。
- **隐私默认开启**：远程图片默认拦截、HTML 净化、邮件在沙箱 iframe 中渲染；数据只留在你的电脑上。
- **备注**：CloudMail基于Velo v0.4.21二次开发，在UI界面布局、AI功能拓展做了较大改动，另新增了中文支持，并修复了若干关键错误，考虑到Velo已经长时间不再更新，单独新开仓库支持后续更新。

---

## 功能总览

### 邮件

- 多账号：Gmail（API）与 IMAP/SMTP（Outlook、Yahoo、iCloud、Fastmail、163 等）随时切换
- 会话式阅读：邮件按线程折叠展示，一键展开
- 全文搜索：支持 `from:`、`to:`、`subject:`、`has:attachment`、`is:unread` 等 Gmail 风格操作符
- 命令面板（`Ctrl+K` / `/`）：快速执行操作
- 拖拽归档/打标签、多选批量、置顶、静音、右键菜单
- 收件箱拆分视图：主要 / 更新 / 促销 / 社交 / 订阅邮件 分类页签
- 内联回复、联系人侧栏（Gravatar）
- 邮件列表与阅读区一体化布局：左侧栏内嵌邮件列表，阅读区独占剩余宽度

### 写邮件

- TinyMCE 6 富文本编辑器（在线文档级工具栏：字体/字号/颜色/高亮、加粗斜体下划线删除线、段落与标题、项目符号/编号、对齐/缩进、可编辑表格、图片、链接、特殊字符、清除格式；内联回复支持居中撤销/重做与发送/取消）
- 撤销发送、定时发送、草稿自动保存
- 多签名、可复用模板（支持变量）
- 发送别名（Send-as）与发件人选择
- 拖拽附件 + 内联预览
- 联系人自动补全（按频率排序）

### 存储

- 邮件数据库默认存储在系统数据目录；可在「设置 → 通用 → 存储 → 存储位置」自定义目录（如其他磁盘），程序通过目录联接将数据库落到所选位置，并自动迁移已有邮件以释放系统盘空间。迁移后旧文件被移除，数据不会丢失。

### 智能收件箱

- 稍后提醒（预设/自定义时间）
- 过滤器：自动打标签、归档、删除、加星、标记已读
- AI + 规则自动分类
- 一键退订（RFC 8058）+ 订阅管理
- 新闻订阅聚合与投递计划
- 智能文件夹 / 保存的搜索（支持动态查询令牌）
- 快捷步骤（Quick Steps）：自定义多步批量动作
- 跟进提醒：未收到回复时提醒你

### AI 能力

支持 OpenAI 兼容的任意提供商（Claude / OpenAI / Gemini / Ollama / GitHub Copilot / 自定义 BaseURL），测试连接时可自动探测模型列表：

| 提供商 | 说明 |
|---|---|
| Claude (Anthropic) | Haiku 4.5、Sonnet 4、Opus 4 |
| OpenAI | GPT-4o Mini、GPT-4o、GPT-4.1 系列 |
| Google Gemini | 2.5 Flash、2.5 Pro |
| Ollama / LM Studio | 本地模型，无需 API Key |
| GitHub Copilot | 需 GitHub PAT |
| 自定义 | 任意 OpenAI 兼容端点：BaseURL + API Key + 模型 |

#### 新增 AI 功能一览

- **AI 对话助手（右侧面板）**：跟随当前打开的邮件进行多轮对话，支持引用其他邮件、附件；Markdown 渲染；会话内可切换模型；对话历史本地保存。
- **AI 摘要**：打开 2 封以上邮件的会话自动生成摘要（可在设置中关闭，改用手动“生成摘要”），输出语言跟随界面语言。
- **智能回复**：快速回复建议（2-3 句、更完整），输出语言跟随界面语言。
- **AI 任务提取**：聊天中让 AI 提取待办，出现“添加到任务”确认卡片，一键写入左侧任务栏。
- **Agentic 批量整理**：用自然语言（如“把来自 XX 的未读邮件归档并加星”）让 AI 生成操作计划，确认后批量执行。
- **AI 会议排程**：告诉 AI 安排会议，自动结合日历忙闲给出候选时段，确认后直接创建日历事件。
- **日历问答**：直接问“我下次会议什么时候”，AI 基于本地日历回答。
- **会议简报**：日历事件详情页一键生成议程/会前简报（结合相关邮件）。
- **附件问答**：引用附件后可提问或总结（支持 txt/html/csv/json/md/docx，PDF 支持未压缩文本流）。
- **技能系统 + 插件市场**：内置收件箱整理、会议准备、收件箱清零、写作润色、任务提取等技能；可在设置中浏览/安装远程技能，聊天中通过 `/`、`#`、`@` 使用。

### 日历

Google Calendar 同步，月/周/日视图，可直接创建事件。

### 自动回复（外出）

设置 → 自动回复：创建规则（账号、起止时间、主题、正文、启用开关），窗口期内对每个发件人只回复一次，并统计已回复数量。

### UI 与交互

- 顶部菜单栏：智能文件夹 / 标签下拉 + 邮件视图导航，窗口左上角显示 Logo 与 CloudMail 字标（`ai` 跟随主题色）
- 左侧栏（通底）：账号、写邮件、搜索、邮件列表、设置
- 底部状态栏：同步状态、邮箱在线状态、最近收件信息（仅占内容区底部）
- 右侧拓展区：任务栏 / AI 助手 / 联系人栏
- 深色 / 浅色 / 跟随系统主题，8 种强调色
- 中英文界面一键切换，全部界面与设置项汉化
- 点击顶栏类目自动打开该类目上次阅读的邮件（无记录则打开第一封）

### 隐私与安全

- Gmail OAuth PKCE：无客户端密钥、无后端服务器
- IMAP 密码加密存储（AES-256-GCM）
- 远程图片拦截 + 发件人白名单
- 钓鱼链接检测（10 项启发式评分）
- SPF/DKIM/DMARC 认证展示
- DOMPurify + 沙箱 iframe 渲染

---

## 使用介绍

### 1. 连接邮箱

- **Gmail**：在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 凭据（启用 Gmail API + Calendar API），在 设置 → 账号 填入 Client ID（PKCE，无需 Secret）。
- **IMAP/SMTP（含 163）**：账号切换器 → 添加 IMAP 账号，填写邮箱、授权密码（163 使用“客户端授权密码”），服务器地址与端口可自动发现或手动填写。IMAP 增量同步使用单连接方式，避免连接风暴导致的同步失败。
- **CalDAV 日历**：支持 iCloud、Fastmail、Nextcloud、Zoho 等，仅日历同步。

### 2. 配置 AI

设置 → AI：

1. 选择提供商（或“自定义”填 BaseURL / API Key / 模型，例如 `http://192.168.196.114:3000/v1`）；
2. 点击 **测试连接**：连接成功后自动探测该提供商的模型列表；
3. 在“模型”区设置**默认模型**，候选列表可搜索并一键设为默认；
4. 对话助手顶部可随时**会话级切换模型**（不影响全局默认）。

### 3. 使用 AI 对话助手

- 打开一封邮件，点击顶部功能栏的 ✨ 按钮打开右侧 AI 面板；
- 面板默认“跟随当前邮件”，直接提问即可（摘要、追问、改写等）；
- **引用更多邮件/附件**：点面板上的引用按钮，搜索并多选；对话中也可直接针对附件提问；
- **技能**：输入 `/`、`#` 或 `@` 唤起技能/命令菜单（如 `/summarize`、`/task`、`/meeting`、`/new`），选中技能即对会话生效；
- 顶部 Model 下拉可切换当前会话使用的模型；
- 输出支持 Markdown 渲染，链接/图片点击在外部浏览器打开；
- 输入框高度与面板宽度均可拖拽调整，设置会被记住。

### 4. 任务与批量整理

- 聊天中说“提取任务”或输入 `/task`，AI 返回任务卡片，点“添加到任务”写入左侧任务栏；
- 聊天中说“把……归档/加星/标记已读/打标签”等，AI 生成操作计划卡片，**确认后**批量执行；
- 左侧任务栏支持优先级、截止日期、子任务、按线程关联。

### 5. 会议与简报

- 聊天中点“Meeting”按钮（或说“安排会议”），填写标题、时长、时间范围、参会人，AI 结合日历给出候选时段，选择后创建日历事件；
- 问“我下次会议什么时候”等日历问题直接回答；
- 日历事件详情页点“生成简报”，AI 结合相关邮件生成议程。

### 6. 外出自动回复

设置 → 自动回复 → 新建规则：选择账号、起止时间、主题（留空则 Re: 原标题）、正文；窗口期内自动回复，每个发件人只回复一次。

### 7. 中英文切换

设置 → 通用 → 语言：中文（简体）/ English 一键切换；AI 输出语言、界面文案、邮件标题汉化同步跟随。

### 8. 常用快捷键

完整列表见 [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md)，常用：

- `r` / `a` / `f`：回复 / 全部回复 / 转发
- `e` 归档、`#` 删除、`!` 垃圾邮件、`s` 加星、`h` 稍后提醒、`v` 移动
- `Ctrl+K` 或 `/`：命令面板
- `t`：AI 从邮件提取任务

---

## 安装

下载对应平台的最新版本（Windows 安装包 / macOS / Linux），安装后即可使用，无需编程环境。

### 从源码构建

```bash
git clone https://github.com/YangLizhi/CloudMail.git
cd CloudMail
npm install
npm run tauri dev
```

**依赖**：Node.js 18+、Rust、Tauri v2 系统依赖。

发布构建（Windows 示例）：

```bash
npm run tauri build -- --target x86_64-pc-windows-gnu --no-bundle
```

> 说明：本项目对同步链路做了重要优化（单连接 IMAP 增量同步 + 失败退避），并用 `npm run tauri build --no-bundle` 避免 NSIS 网络下载阻塞。

---

## 数据与隐私

所有数据默认存放在本机应用数据目录（Windows 为 `%APPDATA%\com.cloudmail.app\`）：

| 文件 | 说明 |
|---|---|
| `cloudmail.db` | 邮件/线程/日历/任务等主数据库（SQLite + FTS5，WAL 模式） |
| `cloudmail-settings.json` | 全部设置（分级 JSON，含模型缓存、技能、自动回复等） |
| `cloudmail.key` | 设置加密密钥（AES-256-GCM） |
| `cloudmail-chat.json` | AI 对话历史 |
| `cloudmail-debug.log` | 诊断日志 |
| `cloudmail-attachment-cache/` | 附件缓存 |

旧版本（Velo）数据会在首次启动时自动迁移到 `com.cloudmail.app` 并完成文件改名，无需手动操作。

---

## 技术栈

| | |
|---|---|
| 框架 | Tauri v2（Rust）+ React 19 + TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand 5 |
| 编辑器 | TipTap v3 |
| 邮件 | Gmail API、IMAP/SMTP（Rust async-imap + lettre） |
| 数据库 | SQLite + FTS5 |
| AI | Claude / GPT / Gemini / Ollama / 任意 OpenAI 兼容端点 |
| 测试 | Vitest + Testing Library |

详见 [docs/architecture.md](docs/architecture.md)。

---

## 开源协议

[Apache-2.0](LICENSE)

---

<p align="center">
  基于 Tauri v2 与 React 构建。原项目 Velo 的开源继任者 CloudMail。
</p>
