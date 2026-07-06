### MuMu Emulator 6.0 Upgrade to Android 15 Notice (NEW!!!)

**📱 Instance Upgrade**

MuMu Emulator recently released version 6.0, which supports upgrading devices from Android 12 to Android 15. Two options are provided during the upgrade:  
• **Without retaining the original device**: Directly replaces and upgrades the original instance; port numbers and other settings **remain unchanged**, and MAA can connect normally.  
• **Retaining the original device**: A new instance will be created with new port numbers; the original port will **no longer be connectable**.

If you chose "Retain original device", with **only the new instance running**, go to "Start-up Wake → Settings" or "Settings → Connection Settings" and re-check "Auto-detect Connection".

**📵 Background Keep-Alive**

MuMu provides an "App Keep-Alive" option under "Settings → Other" (previously named "Background Keep-Alive", "Keep Running in Background", etc.).  
Enabling this in Android 15 instances **will cause MAA touch controls to malfunction** - if you experience touch issues, go to MuMu settings to disable it.

**v6.14.0-beta.1 and later** support detecting background keep-alive, and will output a warning in the log when triggered.  
For multi-instance needs, it is **recommended to run multiple independent instances** rather than opening multiple instances within one.

**📸 Screenshot Enhancement Port**

MAA versions **before v6.14.0-beta.1** do not support `emulator-5xxx` format addresses for screenshot enhancement (defaults to `0` when parsing fails).  
If the new instance's connection address uses `emulator-5xxx` format after retaining the original device during upgrade, screenshot enhancement will still connect via `0`, causing an **error**. Manually change it to the `127.0.0.1:xxxx` numeric format; the specific port can be found in MuMu's "Device Diagnostics" (e.g., `127.0.0.1:16416`, `127.0.0.1:5557`).

**v6.14.0-beta.1 and later** are compatible with `emulator-5xxx` format screenshot enhancement addresses.

----

### ⚠️ Beware of Malicious Bundles and Imposter Repositories

Recently, third parties have been found creating fake MAA repositories, tampering with source code, and bundling malicious programs (stealing personal information, planting trojans, etc.). Please be careful:

· MAA is completely free and open-source - we **never** require "follow, like, share, and DM" to access resources;  
· The **only safe download source is the [official website](https://maa.plus)**. Search results may contain imposter repositories - always verify against the official links;  
· Official group links can be found on the official website or via "Settings → About Us → QQ Group" - do not join groups through other channels;  
· Use integration packages, modified versions, or third-party repacks with caution, unless you fully trust the source and have verified their safety.

----

### 📢 [MAA × MirrorChyan] Community Sponsorship Program

MAA has integrated [MirrorChyan](https://mirrorchyan.com/?source=maa-anno-en). Revenue from MirrorChyan is used to maintain the [MAA Official Website](https://maa.plus/), [Copilot Station](https://prts.plus/), and servers. After deducting necessary operational costs, the MAA Team donates its share of revenue - along with additional sponsorship funds provided by MirrorChyan - **entirely** to support quality Arknights community projects. MAA does not participate in the internal operations of sponsored projects.

<table>
  <tr>
    <td colspan="3">Server costs are currently covered for the following community projects:</td>
  </tr>
  <tr>
    <td><a href="https://penguin-stats.cn/">Penguin Statistics</a></td>
    <td><a href="https://ark.yituliu.cn/">Arknights Yituliu</a></td>
    <td><a href="https://wiki.arkrec.com/">ARKREC Wiki</a></td>
  </tr>
  <tr>
    <td><a href="https://arkrog.com/">Arknights Roguelike Tactics</a></td>
    <td><a href="https://map.ark-nights.com/">PRTS.Map</a></td>
    <td><a href="https://www.amiyabot.com/">AmiyaBot</a></td>
  </tr>
  <tr>
    <td><a href="https://arkntools.app/">Arknights Toolbox</a></td>
    <td><a href="https://lungmendragons.com/">Lungmen Dragons</a></td>
    <td><a href="https://www.krooster.com/">ak-roster</a></td>
  </tr>
</table>

📜 **Full Announcement**: [link](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/12328)

----

### 📋 User Guide

**📖 Official Website & Documentation**  
Find MAA's official website and complete documentation at `Settings → About us → MAA Website`.

**🛟 When You Encounter Issues**  
Go to `Settings → Issue Report → Open Debug Folder` to view logs and identify the cause.  
Use `Settings → Issue Report → Generate Support Payload` to generate an error report, then click the blue `Issues` link to submit.

**⚠️ Feedback Guidelines**  
The MAA Team only accepts feedback submitted via [GitHub](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues) following the [Issue template](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/new/choose), and reserves the right to make the final decision on all feedback.

**💡 Contributing to Open Source**  
Contributions are welcome under the [AGPL-3.0](https://github.com/MaaAssistantArknights/MaaAssistantArknights?tab=AGPL-3.0-1-ov-file#readme) license on [GitHub](https://github.com/MaaAssistantArknights/MaaAssistantArknights). The MAA Team encourages meaningful code contributions over issue reports.

**📄 User Agreement**  
By using MAA, you agree to comply with the [User Agreement](https://github.com/MaaAssistantArknights/MaaAssistantArknights/blob/dev-v2/terms-of-service.md). The full text is available via the link at the bottom of the [official website](https://maa.plus/).

----

### Current Update Methods

🌍 **Global Distribution**  
Client updates are pulled from GitHub. Resource update checks are provided by MirrorChyan; you can manually click `Resource Update` to download from GitHub.

🔑 [**MirrorChyan**](https://mirrorchyan.com/?source=maa-anno-en)  
Enter a CDK to enable automatic updates for both client and resources, with priority downloads via high-speed CDN.

📦 [**Manual Update**](https://github.com/MaaAssistantArknights/MaaAssistantArknights/issues/10033)

· **Client version**: Extract the full package into a **new** folder. Copy `config` and `data` from the old folder to preserve data (⚠️ Do not overwrite directly - incorrect operation may cause resource corruption)  
  🆕 v6.8.0-beta.2 and later support dragging the full package or OTA zip into the window for automatic update  
· **Resource version**: Download the [resource package](https://github.com/MaaAssistantArknights/MaaResource/archive/refs/heads/main.zip) and overwrite the existing `resource` folder (⚠️ Incremental content - do not delete the original folder)

----

### Update Explanation

**Client Version**: UI and feature updates for the main application.  
**Resource Version**: Asset data updates, including new stage maps, drop icons, and operator tags for recruitment.  
**Navigation Hot Update**: Triggered automatically to update event notices and stage entries. A "Hot Update Data Loaded" notification appears in the top-right corner upon success.

Each client release includes the latest resources at the time of release. If you don't need features requiring the latest resources, you can postpone updating; update promptly when needed.

**Update Channels**: You can switch between **Stable** and **Beta** channels in `Settings → Update Settings` (beta versions have `-beta.x` in the version number). If the interface shows a version too low and the minimum required version is a beta, but you're already on the latest version, the feature may only be available in the beta channel - wait for the stable release or switch to the beta channel. **Please note that beta versions may have more issues; stable is recommended unless you have specific needs.**

----

### Long-term Notice

Please **do not discuss MAA** on **skland (森空岛)** or under official posts by Arknights / Hypergryph / Yostar on Bilibili, Weibo, etc.  
Sending insider/leaked info to any MAA group is **strictly prohibited**.
