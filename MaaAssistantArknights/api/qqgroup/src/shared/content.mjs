// src/data/*.txt 的解析：浏览器（main.js）与 Node（scripts/gen-recommend.mjs）共用
//
// 通用行解析（parseRows）不涉及业务：去空行/# 注释、行首 * 记为 pin、其余按 | 切分。
// 业务解释（parseGroups / parseChannels / buildPlatforms）定义各文件的含义：
//   content_<platform>.txt : 加群链接|群名称|群号    行首 * = 钉死推荐该群
//   content_channels.txt   : 平台|频道链接|频道名称   行首 * = 该平台推荐改为频道

export const PLATFORMS = ["windows", "android", "mac"];

export const PLATFORM_LABELS = {
    windows: "Windows",
    android: "Android",
    mac: "Mac",
};

// 平台 → 群列表数据文件名（去扩展名）
export const PLATFORM_FILES = {
    windows: "content_windows",
    android: "content_android",
    mac: "content_mac",
};

export const CHANNELS_FILE = "content_channels";

export const GROUPINFO_API = "https://join.maameow.com/api/groupinfo";

export function parseRows(text) {
    return String(text)
        .split(/\r?\n/)
        .map((raw) => raw.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
            let pin = false;
            let body = line;
            if (body.startsWith("*")) {
                pin = true;
                body = body.slice(1).trim();
            }
            return { pin, parts: body.split("|").map((s) => s.trim()) };
        });
}

export function parseGroups(rows) {
    return rows
        .filter((row) => row.parts.length >= 3)
        .map((row) => {
            const [url, name, gid] = row.parts;
            return {
                url,
                name,
                gid,
                // 链接非 http 视为已下架
                active: url.startsWith("http"),
                pinned: row.pin,
            };
        });
}

export function parseChannels(rows) {
    const channels = {};
    for (const row of rows) {
        if (row.parts.length < 3) continue;
        const [platformRaw, url, name] = row.parts;
        const platform = String(platformRaw).toLowerCase();
        if (!PLATFORMS.includes(platform)) {
            console.warn("qqgroup: 频道配置未知平台，已跳过", row.parts);
            continue;
        }
        if (!url.startsWith("http")) {
            console.warn("qqgroup: 频道链接无效，已跳过", row.parts);
            continue;
        }
        channels[platform] = { url, name, pinned: row.pin };
    }
    return channels;
}

// rawRows: { "<文件名去扩展名>": parseRows 的结果 } → { platforms: {...} }
export function buildPlatforms(rawRows) {
    const platforms = {};
    for (const platform of PLATFORMS) {
        platforms[platform] = {
            label: PLATFORM_LABELS[platform],
            groups: parseGroups(rawRows[PLATFORM_FILES[platform]] || []),
            channel: null,
        };
    }
    const channels = parseChannels(rawRows[CHANNELS_FILE] || []);
    for (const platform of PLATFORMS) {
        platforms[platform].channel = channels[platform] || null;
    }
    return platforms;
}

// texts: { "<文件名去扩展名>": 文本内容 }（浏览器侧用 ?raw 导入 txt 后传入）
export function buildPlatformsFromTexts(texts) {
    const rawRows = {};
    for (const [key, text] of Object.entries(texts)) {
        rawRows[key] = parseRows(text);
    }
    return buildPlatforms(rawRows);
}
