### 黑流树海-疯狂的鹿刷钱 (NEW!!!)

地图太复杂了，先整个快速刷钱的脚本

前置要求：解锁特勤分队+鹿精二解锁结构性原理  
位置：小工具-牛杂-黑流树海刷钱

没用新的模板，所以不用更新版本就能用，但需要连上服务器拉取热更内容，~~你能看到这个公告说明应该已经连上了~~如果拉取成功了界面右上角会提示 ｢热更数据获取成功｣，如果牛杂里没有就多重启几次试试

----

### 关于作业格式更新及 MAA 版本兼容性的提醒

上游作业站 PRTS.plus 将于 2026 年 7 月 20 日 起更新作业代码格式。届时，MAA v6.14.0 及更早版本将无法解析新格式的作业代码，导入作业会报错或无法识别。

请务必在 7 月 20 日前将 MAA 升级至 v6.14.1 或更高版本，以确保正常使用。

----

### MuMu 模拟器 6.0 升级安卓 15 注意事项

**📱 实例升级**

MuMu 模拟器最近发布了 6.0 新版本，支持将设备从安卓 12 升级至安卓 15，升级时提供两种方式：  
• **不保留原设备**：直接在原实例上替换升级，端口号等信息**不变**，MAA 可正常连接。  
• **保留原设备**：将新开一个实例，端口号等信息走的是新实例，原来的端口将**无法连接**。

若选择了「保留原设备」，请在**仅开启新实例**的情况下，前往「开始唤醒 - 设置」或「设置 - 连接设置」，重新勾选一次「自动检测连接」。

**📵 后台保活**

MuMu 在「设置 - 其他」中提供了「应用保活」选项（历史版本曾命名为「后台保活」「后台挂机时保活运行」等）。  
在安卓 15 实例中**开启会导致 MAA 无法正常触控**，如遇触控失灵请前往 MuMu 设置关闭。  

**v6.14.0-beta.1 及更新版本**已支持检测后台保活，触发时会在日志中输出警告提醒。  
多开需求**推荐开启多个独立实例**，而不是在同一实例中多开。

**📸 截图增强端口**

**v6.14.0-beta.1 之前**的 MAA 不支持 `emulator-5xxx` 格式的截图增强地址（解析失败时默认返回 `0`）。  
保留原设备升级后如果新实例连接地址选择 `emulator-5xxx` 格式，此时截图增强仍按 `0` 连接会**报错**。请手动改为 `127.0.0.1:xxxx` 数字格式，具体端口可在 MuMu 的「设备诊断」中查找（例如 `127.0.0.1:16416`、`127.0.0.1:5557`）。

**v6.14.0-beta.1 及更新版本**已兼容 `emulator-5xxx` 格式的截图增强地址。

----

### ⚠️ 警惕恶意捆绑及仿冒仓库

近期发现有第三方冒充 MAA 创建假仓库、篡改源码并夹带恶意程序（窃取信息、植入木马等），请大家注意辨别：

• MAA 完全免费开源，**不会**要求"关注、三连、私信"才能获取资源；  
• **唯一安全入口是**[**官网**](https://maa.plus)，搜索结果中可能存在仿冒仓库，请以官网链接为准；  
• 官方群入口可在官网或「设置 → 关于我们 → QQ 群」查看，请勿通过其他渠道加群；  
• 谨慎使用整合包、修改版等第三方版本，除非你完全信任其来源并已自行验证安全性。

----

### 📢 [MAA × Mirror酱] 社区资助计划

MAA 已接入 [Mirror酱](https://mirrorchyan.com/?source=maa-anno)，来自 Mirror酱 的分成用于 [MAA 官网](https://maa.plus/)、[作业站](https://prts.plus/) 及服务器维护。MAA 项目组将自身所获分成在扣除必要运营成本后，连同 Mirror酱 额外提供的专项赞助资金，**全部**用于支持优质方舟社区项目，不参与受助项目内部运营。

<table>
  <tr>
    <td colspan="3">目前已为以下方舟社区项目承担服务器成本：</td>
  </tr>
  <tr>
    <td><a href="https://penguin-stats.cn/">企鹅物流数据统计</a></td>
    <td><a href="https://ark.yituliu.cn/">明日方舟一图流</a></td>
    <td><a href="https://wiki.arkrec.com/">明日方舟少人 WIKI</a></td>
  </tr>
  <tr>
    <td><a href="https://arkrog.com/">影语集</a></td>
    <td><a href="https://map.ark-nights.com/">PRTS.Map</a></td>
    <td><a href="https://www.amiyabot.com/">AmiyaBot</a></td>
  </tr>
  <tr>
    <td><a href="https://arkntools.app/">明日方舟工具箱</a></td>
    <td><a href="https://lungmendragons.com/">Lungmen Dragons</a></td>
    <td><a href="https://www.krooster.com/">ak-roster</a></td>
  </tr>
</table>

📜 [**公告原文**](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/12328)

----

### 📋 使用指引

**📖 官网与文档**  
您可以在「设置 - 关于我们 - 官网」找到 MAA 的官方网站和完整文档。

**🛟 遇到问题时**  
前往「设置 - 问题反馈 - 打开日志文件夹」查看日志，了解错误原因。  
请使用「设置 - 问题反馈 - 生成日志压缩包」生成错误报告，并点击蓝色的「问题反馈」链接提交反馈。

**⚠️ 反馈规范**  
MAA Team 仅受理通过 [GitHub](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues) 依 [Issue 模板](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/new/choose) 规范提交的反馈，并保留对所有反馈的处理决定权。

**💡 参与开源**  
欢迎依据 [AGPL-3.0](https://github.com/MaaAssistantArknights/MaaAssistantArknights?tab=AGPL-3.0-1-ov-file#readme) 许可证在 [GitHub](https://github.com/MaaAssistantArknights/MaaAssistantArknights) 参与开发，MAA Team 鼓励通过代码贡献代替问题反馈。

**📄 用户协议**  
使用 MAA 即表示您同意遵守「[用户协议](https://github.com/MaaAssistantArknights/MaaAssistantArknights/blob/dev-v2/terms-of-service.md)」，完整内容可在 [官网](https://maa.plus/) 底部链接查看。

----

### 现行更新方式

🌏 **海外源**  
软件版本从 GitHub 拉取；资源版本由 Mirror酱 提供更新检测，可手动点击 `资源更新` 从 GitHub 下载

🔑 [**Mirror酱**](https://mirrorchyan.com/?source=maa-anno)  
填写 CDK 后支持软件与资源自动更新，优先通过高速 CDN 下载

📦 [**手动更新**](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/10033)  
• **软件版本**：解压完整包至**新**文件夹，可复制旧目录的 `config` 和 `data` 保留数据（⚠️ 请勿直接覆盖，错误操作可能导致资源损坏）  
  🆕 v6.8.0-beta.2 起支持将完整包或 OTA zip 拖入窗口自动更新  
• **资源版本**：下载 [资源包](https://github.com/MaaAssistantArknights/MaaResource/archive/refs/heads/main.zip) 后直接覆盖 `resource` 文件夹（⚠️ 增量内容，请勿删除原文件夹）

----

### 更新说明

**软件版本**：主程序的界面和功能更新。  
**资源版本**：素材数据更新，包含新关卡地图、掉落物图标、公招干员标签等。  
**导航热更**：自动触发，更新活动提示和关卡入口，成功后右上角提示「热更数据获取成功」。

软件版本发布时包含当时最新资源，若不使用新资源相关功能可暂不更新；需要时请及时更新资源。

**更新渠道**：可在「设置 - 更新设置」中切换**正式版**和**公测版**（版本号含 `-beta.x` 的为公测版）。若界面提示版本过低且最低需求版本为公测版，但检测已是最新版本，说明该功能目前仅在公测版中提供，需等待正式版发布或切换至公测版获取。**请注意，公测版可能存在更多问题，如无特殊需求建议使用正式版。**

----

### 长期公告

请勿在 森空岛 及 明日方舟/鹰角网络在 B 站、微博等平台的**官方动态** 下讨论 MAA 相关内容。  
**禁止**将内鬼消息发送至任何 MAA 群。
