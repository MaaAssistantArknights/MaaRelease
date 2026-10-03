// 本文件是 Vite 工程的 ES module 入口（src/main.js），由 index.html 以
// <script type="module"> 引入，经 pnpm run build 产出到上级目录的 index.html
// （vite-plugin-singlefile 内联，单文件自包含）。
//
// 数据来源（全部在构建期打包，运行时无请求）：
//   src/data/content_*.txt  群列表 / 频道配置（解析规则见 shared/content.mjs）
//   src/data/recommend.json 当前推荐（由 pnpm run gen 写入，所有访客看到同一个推荐）
// 人数与头像是唯一的运行时数据，来源 join.maameow.com/groupinfo。
//
// ?raw 是 Vite 的约定后缀（由 vite:asset 插件实现，非 web 标准）：
//   把文件内容当字符串导入，而不是当资源处理。
//   这里是必需的——content_*.txt 不是 JS 模块，不加 ?raw 无法 import；
//   加了之后四个文件的内容会作为 JS 字符串常量内联进 bundle（配合
//   vite-plugin-singlefile，最终产物里没有额外的 .txt 请求）。
//   同类后缀还有 ?url（返回资源 URL）、?inline（强制内联）、?worker。
//   注意：Node 侧（scripts/gen-recommend.mjs）没有 Vite，用 fs.readFileSync 读同一批文件，
//   两边共用 shared/content.mjs 的解析函数。
import windowsTxt from "./data/content_windows.txt?raw";
import androidTxt from "./data/content_android.txt?raw";
import macTxt from "./data/content_mac.txt?raw";
import channelsTxt from "./data/content_channels.txt?raw";
// JSON 导入是 Vite 原生支持（无需后缀），构建时同样会被内联
import RECOMMENDS from "./data/recommend.json";
import { PLATFORM_LABELS, GROUPINFO_API, buildPlatformsFromTexts } from "./shared/content.mjs";

// 文件名 → buildPlatformsFromTexts 认识的键（去掉目录与 .txt 后缀）
const PLATFORMS = Object.keys(PLATFORM_LABELS);
// buildPlatformsFromTexts 返回的是「平台 → {label, groups, channel}」字典，
// 这里包一层成 { platforms }，与下面 DATA.platforms 的用法保持一致
const DATA = {
    platforms: buildPlatformsFromTexts({
        content_windows: windowsTxt,
        content_android: androidTxt,
        content_mac: macTxt,
        content_channels: channelsTxt,
    }),
};

const groupInfoCache = Object.create(null); // gid -> info | null(failed)

// 全文件不使用 innerHTML / document.write：所有外部数据（txt 配置、groupinfo API
// 返回值）一律走文本节点或属性赋值，从根上避免 XSS sink 告警。

// ---- 自动跳转 ----

let redirectEnabled = false;
let countdown = 8;
let countdownTimer = null;
let currentJoinUrl = "";
let currentPlatform = "";
let userCancelled = false;

function stopCountdown() {
    redirectEnabled = false;
    if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
    }
}

function cancelRedirect() {
    userCancelled = true;
    stopCountdown();
    const text = document.getElementById("redirectText");
    if (text) text.textContent = "自动跳转已取消，可点击上方按钮或下方群链接加入";
}

function handleLinkClick() {
    // 点了列表里的群/频道：取消自动跳转，但保留已选平台与主按钮
    if (currentPlatform) cancelRedirect();
}

function handlePrimaryLinkClick(event) {
    const primary = document.getElementById("primaryLink");
    if (primary.classList.contains("is-disabled") || !currentJoinUrl) {
        event.preventDefault();
        return;
    }
    cancelRedirect();
}

function startRedirect(url) {
    if (userCancelled) {
        // 用户已取消过：只更新链接，不再自动跳
        currentJoinUrl = url;
        const text = document.getElementById("redirectText");
        if (text) text.textContent = "自动跳转已取消，可点击上方按钮或下方群链接加入";
        return;
    }
    currentJoinUrl = url;
    redirectEnabled = true;
    countdown = 8;
    if (countdownTimer) clearTimeout(countdownTimer);

    const text = document.getElementById("redirectText");
    if (text) {
        text.replaceChildren();
        text.appendChild(document.createTextNode("已选择平台，页面将在 "));
        const cd = el("span", "", String(countdown));
        cd.id = "countdown";
        text.appendChild(cd);
        text.appendChild(document.createTextNode(" 秒后自动跳转……"));
        const cancelBtn = el("button", "cancel-btn", "取消自动跳转");
        cancelBtn.type = "button";
        cancelBtn.id = "cancelBtn";
        cancelBtn.addEventListener("click", cancelRedirect);
        text.appendChild(cancelBtn);
    }
    countdownTimer = setTimeout(updateCountdown, 1000);
}

function updateCountdown() {
    if (redirectEnabled && countdown > 0) {
        countdown--;
        const el = document.getElementById("countdown");
        if (el) el.textContent = countdown;
        countdownTimer = setTimeout(updateCountdown, 1000);
    } else if (redirectEnabled && countdown === 0) {
        window.location.href = currentJoinUrl;
    }
}

// ---- 人数 / 头像（外部 API 数据，不进 innerHTML）----

function renderMembersInto(el, info) {
    if (!el) return false;
    el.replaceChildren();
    const max = info && info.known ? info.max_member_count : 0;
    if (!max || max <= 0) {
        el.hidden = true;
        return false;
    }
    const free = typeof info.free_slots === "number" ? info.free_slots : Math.max(0, max - info.member_count);
    const span = document.createElement("span");
    span.className = free <= 0 ? "full" : "ok";
    span.textContent = `${info.member_count} / ${max} · ${free <= 0 ? "已满" : "余 " + free}`;
    el.appendChild(span);
    el.hidden = false;
    return true;
}

function applyInfoToItem(li, info) {
    const avatar = li.querySelector(".group-avatar");
    const meta = li.querySelector(".group-meta");
    const known = !!(info && info.known);
    if (avatar) {
        if (known && info.avatar_url) {
            avatar.src = info.avatar_url;
            avatar.alt = (info.group_name || "") + " 头像";
            avatar.hidden = false;
        } else {
            avatar.hidden = true;
            avatar.removeAttribute("src");
        }
    }
    renderMembersInto(meta, known ? info : null);
}

function clearHeaderRecExtra() {
    applyHeaderRecExtra(null);
}

function applyHeaderRecExtra(info) {
    const row = document.getElementById("headerRecRow");
    const img = document.getElementById("headerAvatar");
    const members = document.getElementById("headerMembers");
    if (!row) return;
    let show = false;
    if (img) {
        if (info && info.known && info.avatar_url) {
            img.src = info.avatar_url;
            img.alt = (info.group_name || "推荐群") + " 头像";
            img.hidden = false;
            show = true;
        } else {
            img.hidden = true;
            img.removeAttribute("src");
        }
    }
    if (renderMembersInto(members, info)) show = true;
    row.classList.toggle("is-visible", show);
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function applyPlatformInfoForIds(platform, ids, recGid) {
    // 只刷新本批相关 DOM，有结果就先展示
    ids.forEach((id) => {
        if (!(id in groupInfoCache)) return;
        document
            .querySelectorAll(`.group-item[data-platform="${platform}"][data-gid="${id}"]`)
            .forEach((li) => applyInfoToItem(li, groupInfoCache[id]));
    });
    if (recGid && recGid in groupInfoCache) {
        applyHeaderRecExtra(groupInfoCache[recGid]);
    }
}

async function fetchGroupInfoBatch(ids, onPartDone) {
    const missing = ids.filter((id) => !(id in groupInfoCache));
    const already = ids.filter((id) => id in groupInfoCache);
    if (already.length) onPartDone(already);
    if (!missing.length) return;

    // 小批量串行；每批返回立刻 onPartDone，不用等全部
    for (const part of chunk(missing, 5)) {
        try {
            const url = `${GROUPINFO_API}?ids=${encodeURIComponent(part.join(","))}`;
            const resp = await fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                cache: "default",
            });
            const body = resp.ok ? await resp.json() : null;
            const list =
                body && body.code === 0 && body.data
                    ? Array.isArray(body.data.groups)
                        ? body.data.groups
                        : body.data.group_id
                          ? [body.data]
                          : []
                    : [];
            const byId = Object.create(null);
            list.forEach((g) => {
                if (g && g.group_id) byId[String(g.group_id)] = g;
            });
            part.forEach((id) => {
                const g = byId[id];
                groupInfoCache[id] = g && g.known ? g : null;
            });
        } catch (e) {
            part.forEach((id) => {
                groupInfoCache[id] = null;
            });
        }
        onPartDone(part);
    }
}

async function loadPlatformGroupInfo(platform) {
    const ids = Array.from(document.querySelectorAll(`.group-item[data-platform="${platform}"][data-gid]`))
        .map((li) => li.getAttribute("data-gid"))
        .filter(Boolean);

    // 推荐群也查一下（可能与列表同一 gid），并优先拉取让顶部更早出数
    const rec = RECOMMENDS[platform];
    const recGid = rec && rec.kind !== "channel" && rec.gid ? String(rec.gid) : "";
    if (!recGid) clearHeaderRecExtra();
    if (recGid) ids.push(recGid);

    const unique = Array.from(new Set(ids));
    if (recGid) unique.splice(unique.indexOf(recGid), 1);
    if (recGid) unique.unshift(recGid);
    if (!unique.length) return;

    const cached = unique.filter((id) => id in groupInfoCache);
    if (cached.length) applyPlatformInfoForIds(platform, cached, recGid);
    // 逐批回调：哪批好了就先画哪批；平台已切换则丢弃过期回调
    await fetchGroupInfoBatch(unique, (partIds) => {
        if (currentPlatform === platform) applyPlatformInfoForIds(platform, partIds, recGid);
    });
}

// ---- 列表渲染（DOM API 构建；「当前推荐」文案由 CSS ::after 生成）----
// 不用 innerHTML：群名/链接来自 content_*.txt，虽是仓库内数据，但走文本节点与
// 属性赋值可以彻底避免 XSS 告警（CodeQL、Sourcery 都会盯 innerHTML sink）。

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function isGroupRecommend(rec, g) {
    return !!rec && rec.kind === "group" && String(rec.gid) === String(g.gid);
}

function buildGroupItem(platform, g, rec) {
    const gid = String(g.gid || "");
    const li = el("li", "group-item");
    li.setAttribute("data-platform", platform);
    li.setAttribute("data-gid", gid);
    // 构建期写入的推荐标记；选平台时由 markPlatformRecommend 切成 is-recommend
    if (isGroupRecommend(rec, g)) li.setAttribute("data-recommend", "1");

    const row = el("div", g.active ? "group-row" : "group-row disabled-row");
    // 头像/人数由 groupinfo API 填充，失败则保持隐藏
    const avatar = el("img", "group-avatar");
    avatar.alt = "";
    avatar.width = 40;
    avatar.height = 40;
    avatar.hidden = true;
    const body = el("div", "group-body");
    body.appendChild(el("span", "group-title", `${g.name || ""} (${gid})`));
    const meta = el("span", "group-meta");
    meta.hidden = true;
    body.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(body);

    if (g.active) {
        const a = el("a", "group-link");
        a.href = g.url;
        a.appendChild(row);
        li.appendChild(a);
    } else {
        li.appendChild(row);
    }
    return li;
}

function buildChannelItem(platform, ch, rec) {
    const li = el("li", "channel channel-item");
    li.setAttribute("data-platform", platform);
    if (rec && rec.kind === "channel") li.setAttribute("data-recommend", "1");
    const a = el("a", "", ch.name || "");
    a.href = ch.url;
    li.appendChild(a);
    return li;
}

function renderLists() {
    const platforms = DATA.platforms || {};
    const hasAnyChannel = PLATFORMS.some((p) => platforms[p] && platforms[p].channel);
    const anyChannelRec = PLATFORMS.some((p) => RECOMMENDS[p] && RECOMMENDS[p].kind === "channel");

    // 任一平台推荐是频道时用频道风格头图（选平台后仍会切换文案）
    const header = document.getElementById("join-header");
    if (header) header.classList.toggle("channel-header", anyChannelRec);
    const channelBlock = document.getElementById("channelBlock");
    if (channelBlock) channelBlock.style.display = hasAnyChannel ? "" : "none";

    const channelList = document.getElementById("channelList");
    if (channelList) {
        channelList.replaceChildren();
        for (const p of PLATFORMS) {
            const pd = platforms[p];
            if (pd && pd.channel) {
                channelList.appendChild(buildChannelItem(p, pd.channel, RECOMMENDS[p]));
            }
        }
    }

    const sections = document.getElementById("groupSections");
    if (sections) {
        sections.replaceChildren();
        for (const p of PLATFORMS) {
            const pd = platforms[p];
            if (!pd) continue;
            const groups = pd.groups || [];
            const valid = groups.filter((g) => g.active).length;

            const section = el("section", "group-section");
            section.id = "section-" + p;
            section.setAttribute("data-platform", p);
            const title = el("h3", "group-section-title");
            title.appendChild(document.createTextNode(`${pd.label || p} 群组 `));
            title.appendChild(el("span", "group-count", `共 ${valid} 个`));
            const ul = el("ul", "group-list");
            for (const g of groups) ul.appendChild(buildGroupItem(p, g, RECOMMENDS[p]));
            section.appendChild(title);
            section.appendChild(ul);
            sections.appendChild(section);
        }
    }
}

// ---- 平台选择 ----

function normalizePlatform(raw) {
    const s = String(raw || "")
        .trim()
        .toLowerCase();
    return (
        {
            windows: "windows",
            win: "windows",
            win32: "windows",
            pc: "windows",
            android: "android",
            and: "android",
            mac: "mac",
            macos: "mac",
            osx: "mac",
            darwin: "mac",
        }[s] || ""
    );
}

function platformFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        for (const key of ["platform", "os", "p", "client"]) {
            const v = normalizePlatform(params.get(key));
            if (v && DATA.platforms[v]) return v;
        }
        // 兼容 #windows / #mac / #platform=android
        let h = (window.location.hash || "").replace(/^#/, "");
        const eq = h.indexOf("=");
        if (eq >= 0) h = h.slice(eq + 1);
        const v = normalizePlatform(h);
        if (v && DATA.platforms[v]) return v;
    } catch (e) {}
    return "";
}

function syncPlatformToUrl(platform) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("platform", platform);
        for (const k of ["os", "p", "client"]) url.searchParams.delete(k);
        const next = url.pathname + url.search + (url.hash || "");
        if (next !== window.location.pathname + window.location.search + window.location.hash) {
            history.replaceState(null, "", next);
        }
    } catch (e) {}
}

function markPlatformRecommend(platform) {
    // 只切 class：推荐标记来自构建期写入的 data-recommend，后缀与配色由 CSS ::after 处理
    document.querySelectorAll(".group-section").forEach((sec) => {
        sec.classList.toggle("is-active", sec.dataset.platform === platform);
    });
    document.querySelectorAll(".group-item").forEach((li) => {
        li.classList.toggle("is-recommend", li.dataset.platform === platform && li.dataset.recommend === "1");
    });

    let hasChannel = false;
    document.querySelectorAll(".channel-item").forEach((li) => {
        const match = li.dataset.platform === platform;
        li.classList.toggle("is-active", match);
        li.classList.toggle("is-recommend", match && li.dataset.recommend === "1");
        if (match) hasChannel = true;
    });

    const listsPlaceholder = document.getElementById("listsPlaceholder");
    if (listsPlaceholder) listsPlaceholder.classList.add("is-hidden");
    const channelPlaceholder = document.getElementById("channelPlaceholder");
    if (channelPlaceholder) {
        channelPlaceholder.classList.toggle("is-hidden", hasChannel);
        if (!hasChannel) channelPlaceholder.textContent = "该平台暂无 QQ 频道";
    }
    const channelBlock = document.getElementById("channelBlock");
    if (channelBlock) channelBlock.classList.toggle("is-empty", !hasChannel);
}

function selectPlatform(platform, options) {
    const rec = RECOMMENDS[platform];
    if (!rec) return;
    options = options || {};

    // 主动点选平台视为新意图：重新开启自动跳转
    userCancelled = false;
    currentPlatform = platform;

    document.querySelectorAll(".platform-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.platform === platform);
    });
    markPlatformRecommend(platform);
    clearHeaderRecExtra();
    loadPlatformGroupInfo(platform);

    const label = PLATFORM_LABELS[platform] || platform;
    const isChannel = rec.kind === "channel";
    const title = document.getElementById("join-title");
    if (title) {
        title.replaceChildren();
        title.appendChild(document.createTextNode("欢迎加入【"));
        title.appendChild(document.createTextNode(rec.name));
        title.appendChild(document.createTextNode(`】（${label}）`));
    }

    const gidEl = document.getElementById("join-gid");
    if (gidEl) {
        gidEl.replaceChildren();
        if (!isChannel && rec.gid) {
            gidEl.appendChild(document.createTextNode("群号: "));
            gidEl.appendChild(el("strong", "", String(rec.gid)));
            gidEl.style.display = "";
        } else {
            gidEl.style.display = "none";
        }
    }

    const primary = document.getElementById("primaryLink");
    const btnText = primary.querySelector(".btn-text");
    if (btnText) btnText.textContent = isChannel ? "立即加入 QQ 频道" : "立即加入当前推荐群组";
    primary.href = rec.url;
    primary.classList.remove("is-disabled");
    primary.setAttribute("aria-disabled", "false");

    if (!options.skipUrlSync) syncPlatformToUrl(platform);
    startRedirect(rec.url);
}

// ---- 启动 ----

function wireStaticControls() {
    document.querySelectorAll(".platform-tab").forEach((btn) => {
        btn.addEventListener("click", () => selectPlatform(btn.dataset.platform));
    });
    const primary = document.getElementById("primaryLink");
    if (primary) primary.addEventListener("click", handlePrimaryLinkClick);
    // 列表项是动态创建的，用事件委托而不是逐个绑定
    document.addEventListener("click", (e) => {
        if (e.target.closest(".group-link, .channel-item a")) handleLinkClick();
    });
}

// URL 带平台时自动选中，无需手动点
// 例: ?platform=windows  ?os=android  ?p=mac  #windows
function initPlatformFromUrl() {
    const p = platformFromUrl();
    if (p) selectPlatform(p, { skipUrlSync: true });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        wireStaticControls();
        renderLists();
        initPlatformFromUrl();
    });
} else {
    wireStaticControls();
    renderLists();
    initPlatformFromUrl();
}
