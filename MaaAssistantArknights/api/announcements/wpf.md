# 基建排班生成器无法打开

问题已在 v5.4.1-beta.1 版本修复，正式版可点开链接后点击 `带我回家`，选择语言后进入文档站，依次点击 `协议文档` -> `基建排班协议` -> `可视化排班生成工具` 打开工具。
<img src="https://ota.maa.plus/MaaAssistantArknights/api/announcements/img/1.png" width="100%" /><br>

# 重要提示

由于兼容性原因，由官方发布的 v5.4.0-beta 之后版本的 MAA 将无法在 Win7 上正常运行，即使尝试下述方法，也可能无法解决问题。
MAA 后续版本将不再支持 Win7 操作系统。为获得最佳体验，建议升级到更新的 Windows 版本。
如果您仍需在 Win7 上使用 MAA，建议使用旧版本 runner image 自行编译代码，以确保兼容性和稳定性。

## GitHub Actions Runner 更新导致部分用户无法运行新版本

由于 GitHub Actions runner 进行了更新，导致部分用户无法运行新打出来的包。为了解决这一问题，我们建议您安装最新版本的两个运行库。

即使您现在能够正常运行，仍然强烈建议重新安装以下运行库以确保稳定性。

下载链接：

VC++ 运行库: https://aka.ms/vs/17/release/vc_redist.x64.exe

.NET 8 运行库: https://dotnet.microsoft.com/zh-cn/download/dotnet/thank-you/runtime-desktop-8.0.6-windows-x64-installer

使用 Winget 安装（推荐）：

win11 和 较新版本的 win10 可以直接使用命令行直接安装：
``` powershell
winget install Microsoft.VCRedist.2015+.x64
winget install Microsoft.DotNet.DesktopRuntime.8
```

# 长期公告

请不要在明日方舟及鹰角在各平台（包括不限于：森空岛、B 站、微博）的官方动态下讨论任何关于 MAA 内容。  

请勿参加内鬼消息的传播，禁止将内鬼消息发送至任何 MAA 群。  

<img src="https://ota.maa.plus/MaaAssistantArknights/api/announcements/img/NoSkland.jpg" width="100%" /><br>
