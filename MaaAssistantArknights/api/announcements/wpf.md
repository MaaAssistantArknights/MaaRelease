### Windows 端一键长草任务配置重构 (NEW!!!)

在 v6.3.0 中，我们重构了 Windows 端 「一键长草」任务系统。现在支持左下角的加号按钮添加多个同类型任务，右键任务齿轮即可进行重命名与删除。

同时新增 `理智作战按星期执行` 功能，可按周一至周日控制任务运行。你可以结合多任务机制，例如在主理智任务前添加一个仅用于剿灭的任务，并设置为仅在周一执行，从而实现更精细的任务策略。

此外，在执行一键长草流程时，任务勾选框会根据运行状态以不同颜色显示，直观反馈任务被跳过、执行中、已完成或失败等情况。

**由于现已支持按星期执行与多任务配置，本次更新 移除了「剿灭失败后自动尝试下一个已开放关卡」的逻辑。如有需要，请通过添加多个理智作战任务自行实现替代方案。**

----

### 💻 PC 端明日方舟

🎉 MAA 现已支持 PC 端明日方舟的运行。但由于维护人手有限，PC 端版本可能长期处于不稳定状态，部分功能可能出现异常或暂时无法使用。我们非常欢迎社区开发者协助适配并提交改进，共同完善对 PC 端的支持。

----

### 📢 [MAA × Mirror酱] 社区资助计划

MAA 现已接入 [Mirror酱](https://mirrorchyan.com/?source=maa-anno) —— 一个面向开源社区的有偿分发平台：

🤝 **收益共享**

来自 [Mirror酱](https://mirrorchyan.com/?source=maa-anno) 的分成将用于 [MAA 官网](https://maa.plus/)、[作业站](https://zoot.plus/)及服务器维护。

❤️ **社区资助计划扩展**

作为非营利组织，**MAA 项目组** 与 **Mirror酱** 经友好协商后，决定联合启动 **社区资助计划**，将来自 **Mirror酱** 的收益分成及专项赞助资金，在扣除必要运营成本后，**全部** 用于为优质方舟社区项目承担运营成本。

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

**资助原则**：  
· 清偿历史赤字  
· 持续支付服务器 / CDN 费用  
· 不参与项目内部运营，仅提供后勤支持

📜 **公告原文**: [链接](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/12328)

----

### 📋 使用指引

**📖 官网与文档**  
您可以在「设置 - 关于我们 - 官网」找到 MAA 的官方网站和完整文档。

**🛟 遇到问题时**  
您可以前往「设置 - 问题反馈 - 打开日志文件夹」查看日志，了解错误发生的具体原因  
请使用「设置 - 问题反馈 - 生成日志压缩包」生成错误报告，并点击蓝色的「问题反馈」链接提交反馈

**⚠️ 反馈规范**  
MAA Team 仅受理用户通过 GitHub 平台依照 Issue 模板规范提交的反馈，并保留对所有反馈的处理决定权。

**💡 参与开源**  
作为开源项目，用户可依据 AGPL-3.0 许可证在 GitHub 平台参与 MAA 的开发。MAA Team 鼓励用户通过更有价值的代码贡献代替问题反馈。

**📄 用户协议**  
使用 MAA 即表示您同意遵守「用户协议」，完整协议内容可在官网底部的链接中查看。

----

### 现行更新方式

🌏 **海外源**

· **软件版本**：由 **MAA Team** 提供更新检测，从 **GitHub** 拉取更新包
· **资源版本**：由 **Mirror酱** 提供免费的更新检测，可手动在设置中点击 `资源更新` 从 **GitHub** 下载

🔑 **Mirror酱**

填写 [CDK](https://mirrorchyan.com/?source=maa-anno) 后，支持**软件与资源的自动更新**，优先通过 **Mirror酱** 高速 CDN 下载，更稳定快速

📦 [**手动更新**](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/10033)

· **软件版本**：解压完整包至**新**文件夹，可复制旧文件夹里的 `config` 和 `data` 文件夹来保留数据  
  ⚠️ 请勿直接覆盖，部分版本需清理旧文件，而手动覆盖不会执行这一步骤，错误操作可能会报资源损坏 ⚠️  
· **资源版本**：下载 [资源包](https://github.com/MaaAssistantArknights/MaaResource/archive/refs/heads/main.zip) 后，直接覆盖现有的 `resource` 文件夹  
  ⚠️ 资源包为增量内容，**请勿删除原文件夹**，会报资源损坏 ⚠️

----

### 更新说明

**软件版本**：包含主程序的界面和功能更新。所有界面相关改动、新功能添加都通过软件更新发布。  
**资源版本**：独立的素材数据更新，包含自动战斗所需的新关卡地图、掉落识别所需的掉落物图标、公招识别所需的干员标签等内容。  
**导航热更**：自动触发。用于更新活动提示和活动关卡入口，成功后界面右上角会提示「热更数据获取成功」。

软件版本发布时包含当时最新资源，若不使用需要最新资源的功能，可以暂时不更新资源；需要时请及时更新资源以保证正确运行。

----

### 长期公告

请不要在明日方舟及鹰角在各平台（包括不限于：森空岛、B 站、微博）的 **官方动态** 下讨论任何关于 MAA 内容。  

请勿参加内鬼消息的传播，**禁止** 将内鬼消息发送至任何 MAA 群。
