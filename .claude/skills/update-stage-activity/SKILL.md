# 修改 MAA 活动信息（StageActivityV2.json）

## 目标文件

`MaaAssistantArknights/api/gui/StageActivityV2.json`（MaaRelease 仓库内，下文相对路径均以 MaaRelease 根为基准）

- 这是 MAA 客户端的 **OTA 热更文件**，经 GitHub Pages 发布（仓库根有 CNAME），GUI 启动时拉取 `gui/StageActivityV2.json` 并缓存到 `cache/gui/`。
- MAA 主仓库（[MaaAssistantArknights](https://github.com/MaaAssistantArknights/MaaAssistantArknights)，通常与本仓库同级克隆，下称"主仓库"）**没有**它的正本，`build/bin/Release/cache/gui/` 下只是本地运行缓存——本文件只改 MaaRelease 这一处。
- 解析代码位于主仓库（只读参考，不要改）：WPF GUI `src/MaaWpfGui/Services/StageManager.cs`（字段权威，全量解析）。

## 保留策略（每服必须遵守）

每个服节点保留：

1. **1 个复刻活动**（sideStoryStage 组，通常含 `SSReopen-XX` 代理关）
2. **1 个新活动**（sideStoryStage 组）
3. **1 个 resourceCollection**（资源收集/全开放，单对象）
4. **所有当前开放的小游戏**（miniGame 数组条目）

前三个槽位各取**最新一期**：条目允许已过期（两期活动之间的空档期即此状态），**等下一期上线时才替换**，不因"已过期"单独删除；也不保留同槽位的更旧条目。小游戏只留当前开放的（GUI 本会自动隐藏过期小游戏）。两服活动档期不同（外服落后国服约半年），替换时按各服自己的档期判断，不要一改全改。

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
| 组 key | 任意 id（`TL`、`SSReopen`、`MT`…），同服内唯一即可 |
| `MinimumRequired` | SemVer 字符串。**组级或关卡级必须有一处**，否则该关卡被**静默丢弃**（解析失败直接 continue）。取支持该活动导航/任务名的最低 MAA 版本（查主仓库 git log / 发布 tag） |
| `Activity.Tip` | 活动提示文案 |
| `Activity.StageName` | 活动名。显示在「今日关卡提示」的 ｢StageName｣ 剩余 N 天；**同时是 miniGame 条目 `Activity` 字段的关联键** |
| `Activity.UtcStartTime` / `UtcExpireTime` | 见下方时间语义。结束时间通常是 `03:59:59` |
| `Activity.TimeZone` | int，小时偏移 |
| `Stages[].Display` | 下拉框显示名；**是去重键**（TryAdd 先到先得），也是可选本地化键 `TaskQueue.Stage.<Display>`（主仓库语言文件命中则翻译，否则原样显示） |
| `Stages[].Value` | 提交给刷理智任务的实际关卡代号，必须可被 tasks.json 导航（复刻代理关为 `SSReopen-XX` 形式） |
| `Stages[].Drop` | 物品 id（主仓库 `resource/item_index.json`，GUI 自动显示物品名+仓库数量）或自由文本（如 `搓玉效率0.69`、`代理1~8关`） |
| `Stages[].Activity` / `MinimumRequired` | 可选，覆盖组级 |

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

## 修改流程

1. 确认各服当前活动档期（官服/外服公告），按保留策略决定增删。
2. 新活动需要确认：关卡代号（`XX-N`）、是否可搓玉（搓玉效率文案）、代理关（复刻）、小游戏任务名及其最低支持版本（查主仓库 git log：`git log --oneline -S "MiniGame@WartimePressCommittee" -- resource/tasks/`）。
3. 编辑 JSON，格式遵循 `.prettierrc` 对 `MaaAssistantArknights/api/gui/*.json` 的覆盖配置：**2 空格缩进**、单行内联 stage/miniGame 对象（`{ "Display": ..., "Value": ..., "Drop": ... }`）。
4. 校验 JSON 合法：`python -m json.tool MaaAssistantArknights/api/gui/StageActivityV2.json > /dev/null`
5. 用了 `DisplayKey`/`TipKey` → grep 主仓库 `src/MaaWpfGui/Res/Localizations/` 确认 key 已存在（各语言文件）；用新 key = 无效，需先发 GUI 版本。
6. 用了 `Drop` 物品 id → 确认存在于主仓库 `resource/item_index.json`。
7. 提交（历史惯例：`chore: Yostar MT rerun (#669)`、`feat: TL 战时新闻委员会 (#667)`、`chore: 添加 TL-4 搓玉活动关卡配置 (#661)`）。

## 检查清单

- [ ] 每服恰好 1 复刻 + 1 新活动 + 1 resourceCollection，且各为**最新一期**（允许已过期、待下一期替换，不得有同槽位旧条目残留）+ 全部当前开放小游戏
- [ ] 所有 sideStoryStage 关卡有 MinimumRequired（组级或关卡级）
- [ ] 所有 miniGame 条目带 UtcStartTime/UtcExpireTime/TimeZone
- [ ] 时间格式 `yyyy/MM/dd HH:mm:ss`，TimeZone 与服匹配（EN 服注意夏令时）
- [ ] DisplayKey/TipKey 在主仓库语言文件中已存在
- [ ] JSON 通过 `python -m json.tool` 校验
- [ ] 2 空格缩进、内联对象风格与现有内容一致
