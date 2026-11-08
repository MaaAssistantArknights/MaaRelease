---
name: update-stage-activity
description: 修改 MAA OTA 活动信息文件 MaaAssistantArknights/api/gui/StageActivityV2.json（sideStoryStage 活动关卡、resourceCollection 资源收集、miniGame 小游戏）及联动的 api/resource/tasks.json 导航热更时使用。包含字段参考、时间/时区语义、每服保留策略与验证清单。
---

# 修改 MAA 活动信息（StageActivityV2.json）

## 目标文件

`MaaAssistantArknights/api/gui/StageActivityV2.json`（MaaRelease 仓库内，下文相对路径均以 MaaRelease 根为基准）

- 这是 MAA 客户端的 **OTA 热更文件**，经 GitHub Pages 发布（仓库根有 CNAME），GUI 启动时拉取 `gui/StageActivityV2.json` 并缓存到 `cache/gui/`。
- MAA 主仓库（[MaaAssistantArknights](https://github.com/MaaAssistantArknights/MaaAssistantArknights)，通常与本仓库同级克隆，下称"主仓库"）**没有**它的正本，`build/bin/*/cache/gui/`（Debug/Release 构建）下只是本地运行缓存——本文件只改 MaaRelease 这一处。
- 联动文件：`MaaAssistantArknights/api/resource/tasks.json`（精简 tasks 覆盖层，活动导航热更，见「tasks.json 联动」）。
- 解析代码位于主仓库（只读参考，不要改）：WPF GUI `src/MaaWpfGui/Services/StageManager.cs`（字段权威，全量解析）。
- 完整活动上线流程（含主仓库 `resource/tasks/Stages/XX.json` 导航文件的编写、本地测试缓存同步）见主仓库 `.agents/skills/side-story-navigation/SKILL.md`；本 skill 覆盖以 MaaRelease 为工作区的部分。

## 保留策略（每服必须遵守）

每个服节点保留：

1. **1 个复刻活动**（sideStoryStage 组，通常含 `SSReopen-XX` 代理关）
2. **1 个新活动**（sideStoryStage 组）
3. **1 个 resourceCollection**（资源收集/全开放，单对象）
4. **所有当前开放的小游戏**（miniGame 数组条目）

前三个槽位各取**最新一期**：判断标准是"最新"而非"当前开放"——活动档期常有重叠（复刻与新活动并行、同槽位前后紧接），不能按是否过期取舍。有新一期上线时立即替换，并**删除该槽位所有更旧的条目（多余的过期内容一律清除）**；仅当暂无新一期时，槽位里的过期条目可保留至下一期上线（两期之间的空档期即此状态），不因"已过期"单独删除。小游戏只留当前开放的（GUI 本会自动隐藏过期小游戏）。两服活动档期不同（外服落后国服约半年），替换时按各服自己的档期判断，不要一改全改。

## 顶层结构

顶层 key 为客户端类型，GUI 按当前客户端选取节点：

| key | 服 | 时区 |
|---|---|---|
| `Official` | 官服（**B 服共用此节点**，无独立 key） | 8 |
| `YoStarJP` | 日服 | 9 |
| `YoStarKR` | 韩服 | 9 |
| `YoStarEN` | 英服 | -7（夏令时）/ -8（冬令时），按当期公告 |
| `txwy` | 繁中服 | 8 |

每个服节点下三个成员：`sideStoryStage`（对象）、`resourceCollection`（对象）、`miniGame`（数组）。

## 字段参考

### sideStoryStage（活动关卡组）

```json
"TL": {
  "MinimumRequired": "v6.21.1",
  "Activity": {
    "Tip": "SideStory「时间啊，向前！」",
    "StageName": "时间啊，向前！",
    "UtcStartTime": "2026/11/01 12:00:00",
    "UtcExpireTime": "2026/11/22 03:59:59",
    "TimeZone": 8
  },
  "Stages": [
    { "Display": "TL-9", "Value": "TL-9", "Drop": "31113" },
    { "Display": "TL-4", "Value": "TL-4", "Drop": "搓玉效率0.69" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| 组 key | 新活动槽位用**活动前缀**（`TL`、`MT`、`PA`），复刻槽位固定 `SSReopen`，同服内唯一 |
| `MinimumRequired` | SemVer 字符串。**组级或关卡级必须有一处**，否则该关卡被**静默丢弃**（解析失败直接 continue）。选章为 OCR 的活动沿用上一期的值；选章为**模板图**的必须设为最新 tag 的下一个版本（见修改流程） |
| `Activity.Tip` | 提示文案，惯例 `SideStory「活动全名」`（复刻追加「复刻」/「Rerun」等），外服用对应语言 |
| `Activity.StageName` | 活动全名（复刻可加后缀与首轮区分）。显示在「今日关卡提示」的 ｢StageName｣ 剩余 N 天；**同时是 miniGame 条目 `Activity` 字段的关联键** |
| `Activity.UtcStartTime` / `UtcExpireTime` | 见下方时间语义。结束时间通常是 `03:59:59` |
| `Activity.TimeZone` | int，小时偏移 |
| `Stages[].Display` | 下拉框显示名；**是去重键**（TryAdd 先到先得），也是可选本地化键 `TaskQueue.Stage.<Display>`（主仓库语言文件命中则翻译，否则原样显示） |
| `Stages[].Value` | 提交给刷理智任务的实际关卡代号，必须可被 tasks.json 导航（复刻代理关为 `SSReopen-XX` 形式） |
| `Stages[].Drop` | 材料掉落写物品 id（按 `name` 字段反查物品表取 key：官服主仓库 `resource/item_index.json`，外服 `resource/global/<服>/resource/item_index.json`；GUI 自动显示物品名+仓库数量；**当期活动代币不写，只写固定掉落的材料**）；搓玉/代理等特殊关直接写文字描述（如 `搓玉效率0.69`、`代理1~8关`），不查表 |
| `Stages[].Activity` / `MinimumRequired` | 可选，覆盖组级 |

排列：`Stages` 数组按关卡编号**从大到小**（高价值关卡在前），搓玉关放最后。

版本门槛行为：当前 MAA 版本 < MinimumRequired 时关卡**仍显示**，但 Drop 被"版本过低"提示替换。

过期活动组从下拉框消失但仍被解析，时间须如实填写。

### resourceCollection（资源收集全开放）

```json
"resourceCollection": {
  "Tip": "资源收集",
  "UtcStartTime": "2026/09/29 16:00:00",
  "UtcExpireTime": "2026/10/20 03:59:59",
  "TimeZone": 8,
  "IsResourceCollection": true
}
```

期间内 CE/AP/CA/LS/SK/PR 资源关全周开放。`IsResourceCollection` 代码中强制为 true，JSON 里保留 `true` 是惯例。单对象，不是数组。

### miniGame（工具箱→小游戏条目）

```json
{
  "MinimumRequired": "v6.21.2",
  "Activity": "时间啊，向前！",
  "Display": "TL-战时新闻委员会",
  "DisplayKey": "Toolbox.MiniGame.TL.WartimePressCommittee",
  "Value": "MiniGame@WartimePressCommittee@Begin",
  "Tip": "在活动主界面（右下角有 ｢开始组版｣ 处）开始任务。",
  "UtcStartTime": "2026/11/01 04:00:00",
  "UtcExpireTime": "2026/11/22 03:59:59",
  "TimeZone": 8
}
```

| 字段 | 说明 |
|---|---|
| `Display` | 兜底显示名（无 DisplayKey 或该 key 无翻译时显示） |
| `DisplayKey` | 本地化键，定义在主仓库 `src/MaaWpfGui/Res/Localizations/*.xaml`，**编译进 GUI**。新 key 需要主仓库 PR + 发版才生效，OTA 无法新增翻译——优先复用已有 key |
| `Value` | 任务名（如 `MiniGame@WartimePressCommittee@Begin`），必须存在于 tasks.json（本体或热更）中 |
| `Tip` / `TipKey` | 提示文案 / 其本地化键（同上，key 需已存在于 GUI） |
| `Category` / `CategoryKey` | 可选，工具箱分组 |
| `MinimumRequired` | 可选。不可解析或高于当前版本 → Tip 被替换为"版本过低"提示（条目仍显示） |
| `UtcStartTime` / `UtcExpireTime` / `TimeZone` | **必填**。WPF 按开放区间过滤，缺失会导致时间解析为 MinValue → 视为已过期 → **条目不显示**。长期保留的条目用 `2099` 年到期 |
| `Activity` | 可选，关联 sideStoryStage 组的 `Activity.StageName`，使小游戏名出现在该活动的今日提示行下 |

## 时间语义（重要）

`UtcStartTime` / `UtcExpireTime` **名不副实**：写入的是活动所在时区的**本地墙上时间**，GUI 解析时减去 `TimeZone` 小时得到 UTC。格式必须严格为 `yyyy/MM/dd HH:mm:ss`（如 `2026/11/22 03:59:59`）。开服时间常见 `16:00:00`（下午四点维护后）或 `04:00:00`/`12:00:00`，以各服公告为准。

格式仅支持**单一** `TimeZone`：活动跨越夏令时切换时（EN 服），两个边界必有一个偏差 1 小时，此时以**结束时刻**所在偏移为准（避免活动结束后界面仍多显示 1 小时）。

⚠️ 时间取**关卡开放周期**，勿取商店周期：商店兑换通常比关卡多开约一周（如关卡 10/23 03:59 关、商店 10/30 03:59 关）。`UtcStartTime` = 关卡开放时刻，`UtcExpireTime` = **关卡关闭时刻**（通常开放日起第 14 天的 `03:59:59`）——该字段控制关卡导航在 GUI 的有效期，wiki/公告两个时间并列时勿拿商店截止时间当 ExpireTime。

## tasks.json 联动（活动导航热更）

`MaaAssistantArknights/api/resource/tasks.json` 是精简 tasks **覆盖层**，全量任务由客户端本地资源提供，此处只放热更所需的条目：

- **新活动导航任务**（选章为 OCR 时才需要写入）：任务块放文件**开头**（`{` 之后、现有内容之前），内容与主仓库 `resource/tasks/Stages/XX.json` 完全一致；**不放依赖项**（`SS-Open`、`SideStoryStage`、`SwipeToStage`、`ChapterSwipeToTheRight` 等基础任务由客户端本地资源提供）。
- **同时删除被替换旧活动的整块任务**（旧前缀开头的所有键）——覆盖层只保留现役活动导航，与 StageActivityV2 旧条目整体替换的语义对齐。
- **选章为模板图时不写入新活动任务**：模板图随客户端版本分发，未达 MinimumRequired 的旧客户端拿不到图，覆盖层下发的导航任务无法执行；此情况仍要删除旧活动整块。
- **修 bug 的单任务热更**（如 OCR 文案修正）追加到文件**末尾**（近期惯例）。
- 倾向**最小化条目**：客户端发版自带任务后，删除对应热更块（如 v6.21.2 发版后"删除战时新闻委员会全量热更"，只保留两个改名任务）。

## 修改流程

1. 确认各服当前活动档期（官服/外服公告），按保留策略决定增删。
2. 新活动需要确认：关卡代号（`XX-N`）、是否可搓玉（搓玉效率文案）、代理关（复刻）、小游戏任务名及其最低支持版本（在主仓库根执行 `git log --oneline -S "MiniGame@WartimePressCommittee" -- resource/tasks/`；任务按目录组织：官服在 `resource/tasks/`，外服在 `resource/global/<服>/resource/tasks/`）。
3. 确定 `MinimumRequired`：选章为 OCR 的活动沿用上一期的值；选章为**模板图**时改为**最新 tag 的下一个版本**（主仓库 `git describe --tags` 查当前，如 `v6.15.1` → `v6.15.2`），并提醒用户复查（模板图需随新版本客户端分发）。
4. 按需同步 `api/resource/tasks.json` 覆盖层（见「tasks.json 联动」）。
5. 编辑 JSON，格式遵循 `.prettierrc` 对 `MaaAssistantArknights/api/gui/*.json` 的覆盖配置：**2 空格缩进**、单行内联 stage/miniGame 对象（`{ "Display": ..., "Value": ..., "Drop": ... }`）。
6. 校验 JSON 合法（无输出即通过，兼容 PowerShell / bash）：`python -c "import json; json.load(open('MaaAssistantArknights/api/gui/StageActivityV2.json', encoding='utf-8'))"`
7. 用了 `DisplayKey`/`TipKey` → grep 主仓库 `src/MaaWpfGui/Res/Localizations/` 确认 key 已存在（各语言文件）；用新 key = 无效，需先发 GUI 版本。
8. 用了 `Drop` 物品 id → 确认存在于主仓库对应服的物品表（官服 `resource/item_index.json`，外服 `resource/global/<服>/resource/item_index.json`）。
9. 提交（历史惯例：`chore: Yostar MT rerun (#669)`、`feat: TL 战时新闻委员会 (#667)`、`chore: 添加 TL-4 搓玉活动关卡配置 (#661)`）。

## 检查清单

- [ ] 每服恰好 1 复刻 + 1 新活动 + 1 resourceCollection，且各为**最新一期**（允许已过期、待下一期替换，不得有同槽位旧条目残留）+ 全部当前开放小游戏
- [ ] 所有 sideStoryStage 关卡有 MinimumRequired（组级或关卡级）
- [ ] 所有 miniGame 条目带 UtcStartTime/UtcExpireTime/TimeZone
- [ ] 时间格式 `yyyy/MM/dd HH:mm:ss`，TimeZone 与服匹配（EN 服注意夏令时）
- [ ] ExpireTime 为**关卡关闭时刻**，非商店截止时刻
- [ ] `Stages` 数组从大到小排列，搓玉关在最后；Drop 只写材料 id 不写代币
- [ ] DisplayKey/TipKey 在主仓库语言文件中已存在
- [ ] JSON 校验通过（`python -c` 命令无输出）
- [ ] 2 空格缩进、内联对象风格与现有内容一致
- [ ] tasks.json 覆盖层：新活动块放开头且已删旧活动整块（模板图选章则不写入）；bug 修复追加末尾
