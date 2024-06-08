# GitHub Actions Runner 更新导致部分用户无法运行新包

由于 GitHub Actions runner 在4天前进行了更新，导致部分用户无法运行新打出来的包。为了解决这一问题，我们建议您安装最新版本的两个运行库。

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
