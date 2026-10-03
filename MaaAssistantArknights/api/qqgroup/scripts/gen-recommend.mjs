// 构建期选群：更新 src/data/recommend.json（= 原来的 gen_index.py，逻辑移植到 Node）
//
// 用法：
//   pnpm run gen                          - 三平台粘性自动
//   pnpm run gen auto                     - 同上
//   pnpm run gen all auto                 - 三个平台都刷（all / every 等价）
//   pnpm run gen windows auto             - 只刷新 Windows（其它平台保持状态，不查人数）
//   pnpm run gen android 2                - 手动钉 Android 第 2 群
//   pnpm run gen windows channel          - Windows 推 QQ 频道
//   pnpm run gen 28                       - 兼容：等同 windows 28
//   pnpm run gen channel                  - 兼容：等同 windows channel
//
// 自动策略（粘性，仅对「本次操作的平台」生效）：
//   1. 从 recommend.json 读取上次推荐
//   2. 只查当前推荐是否满员；未满 / 查失败 → 保持
//   3. 已满 / 已下架 → 按列表顺序选「第一个有空位」的群
//   4. 写回 recommend.json（构建时由 main.js 打包进 index.html，所有访客一致）
//
// 钉死：群列表行首 * 表示该群固定推荐；频道行首 * 表示该平台固定推频道，
//       优先级高于粘性（等价于旧 CI 的 manual / channel 模式）。
//
// 环境变量 GROUPINFO_API 可覆盖查人数用的接口（默认 join.maameow.com）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    PLATFORMS,
    PLATFORM_LABELS,
    PLATFORM_FILES,
    CHANNELS_FILE,
    parseRows,
    buildPlatforms,
} from "../src/shared/content.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "src", "data");
const STATE_FILE = path.join(dataDir, "recommend.json");

const GROUPINFO_API = (
    process.env.GROUPINFO_API || "https://join.maameow.com/api/groupinfo"
).replace(/\/+$/, "");
// 换群时分批查人数，每批找到有空位的就停
const OCCUPANCY_BATCH = 5;

function loadPlatforms() {
    const rawRows = {};
    for (const [platform, file] of Object.entries(PLATFORM_FILES)) {
        rawRows[file] = parseRows(fs.readFileSync(path.join(dataDir, `${file}.txt`), "utf-8"));
    }
    rawRows[CHANNELS_FILE] = parseRows(
        fs.readFileSync(path.join(dataDir, `${CHANNELS_FILE}.txt`), "utf-8")
    );
    return buildPlatforms(rawRows);
}

function loadState() {
    try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
        return data && typeof data === "object" ? data : {};
    } catch {
        return {};
    }
}

function indexOfGid(groups, gid) {
    return groups.findIndex((g) => String(g.gid) === String(gid));
}

function groupRec(g) {
    return { url: g.url, name: g.name, gid: String(g.gid), kind: "group" };
}

// ---- 查人数 ----

async function fetchGroupOccupancy(gids) {
    const out = {};
    if (!gids.length) return out;
    for (let i = 0; i < gids.length; i += 20) {
        const part = gids.slice(i, i + 20);
        const url = `${GROUPINFO_API}?ids=${encodeURIComponent(part.join(","))}`;
        try {
            const resp = await fetch(url, {
                headers: { "User-Agent": "MaaRelease-gen-recommend/1.0", Accept: "application/json" },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const body = await resp.json();
            if (!body || body.code !== 0) continue;
            const data = body.data;
            let items = [];
            if (Array.isArray(data)) items = data;
            else if (data && Array.isArray(data.groups)) items = data.groups;
            else if (data && data.group_id) items = [data];
            for (const g of items) {
                if (g && g.group_id) out[String(g.group_id)] = g;
            }
        } catch (e) {
            console.error(`groupinfo 查询失败 (${e})，将降级`);
        }
    }
    return out;
}

function freeSlotsOf(info) {
    if (!info || !info.known) return null;
    if (typeof info.free_slots === "number") return Math.max(0, info.free_slots);
    const max = parseInt(info.max_member_count, 10) || 0;
    const cur = parseInt(info.member_count, 10) || 0;
    if (max <= 0) return null;
    return Math.max(0, max - cur);
}

// 选「第一个有空位」的群：分批查，找到即停
async function firstWithFreeSlots(groups, platform) {
    const active = groups.filter((g) => g.active);
    if (!active.length) {
        console.error(`自动选群[${PLATFORM_LABELS[platform]}]: 无可用群，回退索引 0`);
        return 0;
    }
    const label = PLATFORM_LABELS[platform];
    let checked = 0;
    for (let start = 0; start < active.length; start += OCCUPANCY_BATCH) {
        const batch = active.slice(start, start + OCCUPANCY_BATCH);
        const occ = await fetchGroupOccupancy(batch.map((g) => g.gid));
        for (const g of batch) {
            checked += 1;
            const free = freeSlotsOf(occ[String(g.gid)]);
            if (free === null) {
                console.error(`自动选群[${label}]: #${indexOfGid(groups, g.gid) + 1} ${g.name} 人数未知，跳过`);
                continue;
            }
            if (free > 0) {
                console.error(
                    `自动选群[${label}]: 选中第一个有空位 #${indexOfGid(groups, g.gid) + 1} ${g.name} 余${free}（已查 ${checked} 个）`
                );
                return indexOfGid(groups, g.gid);
            }
            console.error(`自动选群[${label}]: #${indexOfGid(groups, g.gid) + 1} ${g.name} 已满，继续`);
        }
    }
    console.error(`自动选群[${label}]: 未找到确认有空位的群，回退第一个可用`);
    return indexOfGid(groups, active[0].gid);
}

// ---- 选群 ----

async function stickyAutoIndex(groups, platform, stickyGid) {
    const label = PLATFORM_LABELS[platform];
    const active = groups.filter((g) => g.active);
    if (!active.length) return { index: 0, source: "auto#1-empty" };

    let stickyIndex = -1;
    if (stickyGid) {
        const idx = indexOfGid(groups, stickyGid);
        if (idx < 0) {
            console.error(`粘性[${label}]: 状态群 ${stickyGid} 不在配置中，重新选群`);
        } else if (!groups[idx].active) {
            console.error(`粘性[${label}]: #${idx + 1} ${groups[idx].name} 已下架，重新选群`);
        } else {
            stickyIndex = idx;
        }
    }

    if (stickyIndex >= 0) {
        const g = groups[stickyIndex];
        const occ = await fetchGroupOccupancy([g.gid]);
        const free = freeSlotsOf(occ[String(g.gid)]);
        if (free === null) {
            // 查失败：保持旧推荐，避免乱跳
            console.error(`粘性[${label}]: 保持 #${stickyIndex + 1} ${g.name}（人数暂不可用）`);
            return { index: stickyIndex, source: `sticky#${stickyIndex + 1}-keep-unknown` };
        }
        if (free > 0) {
            console.error(`粘性[${label}]: 保持 #${stickyIndex + 1} ${g.name} 余${free}`);
            return { index: stickyIndex, source: `sticky#${stickyIndex + 1}` };
        }
        console.error(`粘性[${label}]: #${stickyIndex + 1} ${g.name} 已满，按序选第一个有空位`);
    }

    const index = await firstWithFreeSlots(groups, platform);
    return { index, source: `auto-first-free#${index + 1}` };
}

// 未选中的平台：沿用上次状态，不查人数
function freezeRecommend(platform, groups, stickyGid) {
    const label = PLATFORM_LABELS[platform];
    if (stickyGid) {
        const idx = indexOfGid(groups, stickyGid);
        if (idx >= 0 && groups[idx].active) {
            console.error(`保持[${label}]: #${idx + 1} ${groups[idx].name}（本轮未选中，不查人数）`);
            return { rec: groupRec(groups[idx]), source: `keep#${idx + 1}` };
        }
        if (idx >= 0) {
            console.error(`保持[${label}]: 状态群已下架，改用第一个可用群`);
        }
    }
    const first = groups.find((g) => g.active) || groups[0];
    if (!first) throw new Error(`${label} 群列表为空`);
    console.error(`保持[${label}]: 无有效粘性，回退 #${indexOfGid(groups, first.gid) + 1} ${first.name}`);
    return { rec: groupRec(first), source: "keep-fallback" };
}

async function resolveRecommend(platform, groups, channel, mode, manualNumber) {
    // 1. 频道钉死
    if (channel && channel.pinned) {
        return {
            rec: {
                url: channel.url,
                name: channel.name,
                gid: "",
                kind: "channel",
            },
            source: "channel",
        };
    }
    // 2. 群钉死
    const pinned = groups.find((g) => g.pinned && g.active);
    if (pinned) {
        return { rec: groupRec(pinned), source: `pinned#${indexOfGid(groups, pinned.gid) + 1}` };
    }

    // 3. channel 模式：该平台改推频道；无频道配置则回退粘性自动
    if (mode === "channel") {
        if (channel) {
            return {
                rec: { url: channel.url, name: channel.name, gid: "", kind: "channel" },
                source: "channel",
            };
        }
        console.error(`${PLATFORM_LABELS[platform]}: 无频道配置，回退粘性自动`);
    }

    // 4. manual 模式：钉死 content 文件里的第 N 行
    if (mode === "manual") {
        const idx = manualNumber - 1;
        if (idx < 0 || idx >= groups.length) {
            throw new Error(
                `${PLATFORM_LABELS[platform]} 推荐群编号超出范围: ${manualNumber}（共 ${groups.length} 个）`
            );
        }
        return { rec: groupRec(groups[idx]), source: `manual#${manualNumber}` };
    }

    // 5. auto：粘性
    const state = loadState();
    const stickyGid = state[platform] && state[platform].kind === "group" ? state[platform].gid : null;
    const { index, source } = await stickyAutoIndex(groups, platform, stickyGid);
    return { rec: groupRec(groups[index]), source };
}

// ---- 参数解析（用法见文件头；这里只列与直觉不同的两点）----
//   - all / every 是平台别名，等于三个平台一起刷
//   - 「平台 + 0」等价于 channel（沿用旧 gen_index.py 的隐式行为）
const ALIASES = {
    win: "windows",
    windows: "windows",
    android: "android",
    mac: "mac",
    macos: "mac",
    all: "all",
    every: "all",
};

function parseArgs(argv) {
    // 返回 { touch: Set<platform>, mode: platform->mode, manual: platform->number }
    const modes = {};
    for (const p of PLATFORMS) modes[p] = "auto";
    const manual = {};
    const touch = new Set();

    const applyAction = (platform, action) => {
        const targets = platform === "all" ? PLATFORMS : [platform];
        for (const p of targets) {
            touch.add(p);
            if (action === "channel") {
                modes[p] = "channel";
            } else if (/^\d+$/.test(action) && Number(action) > 0) {
                modes[p] = "manual";
                manual[p] = Number(action);
            } else {
                modes[p] = "auto";
            }
        }
        // 手动编号只对单个平台有意义（与旧脚本一致）
        if (targets.length > 1 && /^\d+$/.test(action) && Number(action) > 0) {
            throw new Error("手动编号只能针对单个平台，例如: windows 28");
        }
    };

    if (!argv.length || (argv.length === 1 && /^(auto|sticky)$/.test(argv[0].toLowerCase()))) {
        for (const p of PLATFORMS) touch.add(p);
        return { touch, modes, manual };
    }

    // 兼容旧习惯：单个 channel / 数字都作用于 Windows；0 按 channel 处理
    if (argv.length === 1) {
        const a = argv[0].toLowerCase();
        if (a === "channel" || /^\d+$/.test(a)) {
            applyAction("windows", a === "0" ? "channel" : a);
            return { touch, modes, manual };
        }
    }

    // 平台 + 动作（支持多组串联，如 windows auto mac channel）
    for (let i = 0; i < argv.length; i += 2) {
        const raw = String(argv[i]).toLowerCase();
        const platform = ALIASES[raw];
        if (!platform) {
            throw new Error(`未知平台 ${argv[i]}，应为: ${PLATFORMS.join(" / ")} / all`);
        }
        const action = String(argv[i + 1] ?? "auto").toLowerCase();
        applyAction(platform, action === "0" ? "channel" : action);
    }
    return { touch, modes, manual };
}

// ---- 主流程 ----

async function main() {
    // pnpm 可能把分隔符 -- 也传进来
    const argv = process.argv.slice(2).filter((a) => a !== "--");
    const plan = parseArgs(argv);
    const all = loadPlatforms();

    const state = loadState();
    console.error(
        Object.keys(state).length
            ? "从 recommend.json 读取粘性: " +
              PLATFORMS.filter((p) => state[p]).map((p) => `${p}=${state[p].gid}`).join(", ")
            : "无可用粘性状态（首次生成或尚无群推荐）"
    );
    console.error("本轮操作平台: " + (PLATFORMS.filter((p) => plan.touch.has(p)).join(", ") || "(无)"));

    const next = {};
    const summary = [];
    for (const platform of PLATFORMS) {
        const data = all[platform];
        const mode = plan.touch.has(platform) ? plan.modes[platform] : "freeze";
        const { rec, source } = await resolveRecommend(
            platform,
            data.groups,
            data.channel,
            mode,
            plan.manual[platform]
        );
        next[platform] = rec;
        summary.push(
            `${PLATFORM_LABELS[platform]}:${rec.kind === "channel" ? `频道/${source}` : source}(${rec.name})`
        );
        const valid = data.groups.filter((g) => g.active).length;
        console.error(
            `  - ${PLATFORM_LABELS[platform]}: ${valid} 个群, 推荐来源 ${source}` +
                `, 配置 ${PLATFORM_FILES[platform]}.txt${data.channel ? `, 频道 ${data.channel.name}` : ", 无频道"}`
        );
    }

    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + "\n", "utf-8");
    console.error(`  - 频道配置: ${CHANNELS_FILE}.txt`);
    console.error("  - 粘性状态: src/data/recommend.json");
    console.log(`已更新 recommend.json → ${summary.join(" / ")}`);
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
