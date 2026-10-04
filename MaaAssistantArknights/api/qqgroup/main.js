// 加群页交互。群列表 / 频道 / 推荐全部来自 data.json（由 gen_index.py 生成），
// 本文件不硬编码任何群数据。
//
// 页面在 /api/qqgroup/ 子路径下被 GitHub Pages 服务，fetch 必须用相对路径。

let RECOMMENDS = {};
let CHANNELS = {};
let PLATFORM_LABELS = {};
let GROUPINFO_API = "https://join.maameow.com/api/groupinfo";
const groupInfoCache = Object.create(null); // gid -> info | null(failed)

// 未选平台不自动跳转；URL/?platform= 指定时等同已选并启动跳转
let redirectEnabled = false;
let countdown = 8;
let countdownTimer = null;
let currentJoinUrl = "";
let currentPlatform = "";
let userCancelled = false;

// ---------- 渲染列表 ----------

function makeGroupItem(platform, group, isRecommend) {
    const li = document.createElement("li");
    li.className = "group-item";
    li.setAttribute("data-platform", platform);
    li.setAttribute("data-gid", group.gid);
    li.setAttribute("data-label", group.name + " (" + group.gid + ")");
    if (group.active) li.setAttribute("data-href", group.url);
    if (isRecommend) li.setAttribute("data-recommend", "1");

    const row = document.createElement("div");
    row.className = group.active ? "group-row" : "group-row disabled-row";

    const avatar = document.createElement("img");
    avatar.className = "group-avatar";
    avatar.alt = "";
    avatar.width = 40;
    avatar.height = 40;
    avatar.hidden = true;
    row.appendChild(avatar);

    const body = document.createElement("div");
    body.className = "group-body";
    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = group.name + " (" + group.gid + ")";
    const meta = document.createElement("span");
    meta.className = "group-meta";
    meta.hidden = true;
    body.appendChild(title);
    body.appendChild(meta);
    row.appendChild(body);

    if (!group.active) {
        li.appendChild(row);
        return li;
    }

    const link = document.createElement("a");
    link.className = "group-link";
    link.href = group.url;
    link.addEventListener("click", handleLinkClick);
    link.appendChild(row);
    li.appendChild(link);
    return li;
}

function renderGroupSections(platforms) {
    const host = document.getElementById("groupSections");
    host.replaceChildren();
    for (const platform of Object.keys(platforms)) {
        const info = platforms[platform];
        const rec = RECOMMENDS[platform] || {};

        const section = document.createElement("section");
        section.className = "group-section";
        section.id = "section-" + platform;
        section.setAttribute("data-platform", platform);

        const heading = document.createElement("h3");
        heading.className = "group-section-title";
        heading.textContent = info.label + " 群组";
        const count = document.createElement("span");
        count.className = "group-count";
        count.textContent = "共 " + info.validCount + " 个";
        heading.appendChild(count);
        section.appendChild(heading);

        const list = document.createElement("ul");
        list.className = "group-list";
        info.groups.forEach((group, position) => {
            const isRecommend = rec.kind === "group" && String(rec.gid) === String(group.gid);
            list.appendChild(makeGroupItem(platform, group, isRecommend));
        });
        section.appendChild(list);
        host.appendChild(section);
    }
}

function makeChannelItem(platform, channel, isRecommend) {
    const li = document.createElement("li");
    li.className = "channel channel-item";
    li.setAttribute("data-platform", platform);
    li.setAttribute("data-label", channel.name);
    li.setAttribute("data-href", channel.url);
    if (isRecommend) li.setAttribute("data-recommend", "1");

    const link = document.createElement("a");
    link.href = channel.url;
    link.textContent = channel.name;
    link.addEventListener("click", handleLinkClick);
    li.appendChild(link);
    return li;
}

function renderChannelList(channels) {
    const list = document.getElementById("channelList");
    list.replaceChildren();
    let hasAny = false;
    for (const platform of Object.keys(channels)) {
        const channel = channels[platform];
        if (!channel) continue;
        hasAny = true;
        const rec = RECOMMENDS[platform] || {};
        const isRecommend = rec.kind === "channel" && rec.name === channel.name;
        list.appendChild(makeChannelItem(platform, channel, isRecommend));
    }
    document.getElementById("channelBlock").hidden = !hasAny;
}

function applyData(data) {
    RECOMMENDS = data.recommends || {};
    CHANNELS = data.channels || {};
    if (data.groupinfo_api) GROUPINFO_API = data.groupinfo_api;

    for (const platform of Object.keys(data.platforms || {})) {
        PLATFORM_LABELS[platform] = data.platforms[platform].label;
    }

    // 默认推荐里任一平台是频道时用频道风格头图
    const anyChannel = Object.keys(RECOMMENDS).some((p) => RECOMMENDS[p] && RECOMMENDS[p].kind === "channel");
    document.getElementById("join-header").classList.toggle("channel-header", anyChannel);

    renderGroupSections(data.platforms || {});
    renderChannelList(CHANNELS);
}

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

function handleLinkClick(event) {
    // 点了列表里的群：取消自动跳转，但保留已选平台与主按钮
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
        const cd = document.createElement("span");
        cd.id = "countdown";
        cd.textContent = String(countdown);
        text.appendChild(cd);
        text.appendChild(document.createTextNode(" 秒后自动跳转……"));
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "cancelBtn";
        cancelBtn.className = "cancel-btn";
        cancelBtn.textContent = "取消自动跳转";
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

function renderMembersInto(el, info) {
    // 用 DOM API 写人数，避免 innerHTML + 外部字段触发 XSS 告警
    if (!el) return false;
    el.replaceChildren();
    if (!info || !info.known) {
        el.hidden = true;
        return false;
    }
    const cur = info.member_count;
    const max = info.max_member_count;
    if (!max || max <= 0) {
        el.hidden = true;
        return false;
    }
    const free = typeof info.free_slots === "number" ? info.free_slots : Math.max(0, max - cur);
    const span = document.createElement("span");
    span.className = free <= 0 ? "full" : "ok";
    const freeText = free <= 0 ? "已满" : "余 " + free;
    span.textContent = cur + " / " + max + " · " + freeText;
    el.appendChild(span);
    el.hidden = false;
    return true;
}

function applyInfoToItem(li, info) {
    const avatar = li.querySelector(".group-avatar");
    const meta = li.querySelector(".group-meta");
    if (!info || !info.known) {
        if (avatar) {
            avatar.hidden = true;
            avatar.removeAttribute("src");
        }
        if (meta) {
            meta.hidden = true;
            meta.replaceChildren();
        }
        return;
    }
    if (avatar && info.avatar_url) {
        avatar.src = info.avatar_url;
        avatar.alt = (info.group_name || "") + " 头像";
        avatar.hidden = false;
    } else if (avatar) {
        avatar.hidden = true;
    }
    renderMembersInto(meta, info);
}

function clearHeaderRecExtra() {
    const row = document.getElementById("headerRecRow");
    const img = document.getElementById("headerAvatar");
    const members = document.getElementById("headerMembers");
    if (row) row.classList.remove("is-visible");
    if (img) {
        img.hidden = true;
        img.removeAttribute("src");
    }
    if (members) {
        members.hidden = true;
        members.replaceChildren();
    }
}

function applyHeaderRecExtra(info) {
    const row = document.getElementById("headerRecRow");
    const img = document.getElementById("headerAvatar");
    const members = document.getElementById("headerMembers");
    if (!row || !info || !info.known) {
        clearHeaderRecExtra();
        return;
    }
    let show = false;
    if (img && info.avatar_url) {
        img.src = info.avatar_url;
        img.alt = (info.group_name || "推荐群") + " 头像";
        img.hidden = false;
        show = true;
    } else if (img) {
        img.hidden = true;
    }
    if (renderMembersInto(members, info)) {
        show = true;
    }
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
            .querySelectorAll('.group-item[data-platform="' + platform + '"][data-gid="' + id + '"]')
            .forEach((li) => {
                applyInfoToItem(li, groupInfoCache[id]);
            });
    });
    if (recGid && recGid in groupInfoCache) {
        applyHeaderRecExtra(groupInfoCache[recGid]);
    }
}

async function fetchGroupInfoBatch(ids, onPartDone) {
    const missing = ids.filter((id) => !(id in groupInfoCache));
    // 已有缓存的也回调，方便立刻上屏
    const already = ids.filter((id) => id in groupInfoCache);
    if (already.length && typeof onPartDone === "function") {
        onPartDone(already);
    }
    if (!missing.length) return;

    // 小批量串行；每批返回立刻 onPartDone，不用等全部
    for (const part of chunk(missing, 5)) {
        try {
            const url = GROUPINFO_API + "?ids=" + encodeURIComponent(part.join(","));
            const resp = await fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                cache: "default",
            });
            if (!resp.ok) {
                part.forEach((id) => {
                    groupInfoCache[id] = null;
                });
                if (typeof onPartDone === "function") onPartDone(part);
                continue;
            }
            const body = await resp.json();
            if (!body || body.code !== 0 || !body.data) {
                part.forEach((id) => {
                    groupInfoCache[id] = null;
                });
                if (typeof onPartDone === "function") onPartDone(part);
                continue;
            }
            const list = Array.isArray(body.data.groups) ? body.data.groups : body.data.group_id ? [body.data] : [];
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
        if (typeof onPartDone === "function") onPartDone(part);
    }
}

async function loadPlatformGroupInfo(platform) {
    const items = document.querySelectorAll('.group-item[data-platform="' + platform + '"][data-gid]');
    const ids = [];
    items.forEach((li) => {
        const gid = li.getAttribute("data-gid");
        if (gid) ids.push(gid);
    });
    // 推荐群也查一下（可能与列表同一 gid）
    const rec = RECOMMENDS[platform];
    let recGid = "";
    if (rec && rec.kind !== "channel" && rec.gid) {
        recGid = String(rec.gid);
        ids.push(recGid);
    } else {
        clearHeaderRecExtra();
    }
    // 推荐群优先拉取，顶部头像/人数更早出现
    let unique = Array.from(new Set(ids));
    if (recGid) {
        unique = [recGid].concat(unique.filter((id) => id !== recGid));
    }
    if (!unique.length) {
        clearHeaderRecExtra();
        return;
    }
    // 已缓存的立刻上屏
    const cachedNow = unique.filter((id) => id in groupInfoCache);
    if (cachedNow.length) {
        applyPlatformInfoForIds(platform, cachedNow, recGid);
    }
    // 逐批回调：哪批好了就先画哪批
    await fetchGroupInfoBatch(unique, (partIds) => {
        // 平台已切换则丢弃过期回调
        if (currentPlatform !== platform) return;
        applyPlatformInfoForIds(platform, partIds, recGid);
    });
}

function resetGroupRecommendMarks() {
    document.querySelectorAll(".group-item").forEach((li) => {
        li.classList.remove("is-recommend");
        const title = li.querySelector(".group-title");
        if (!title) return;
        const label = li.getAttribute("data-label") || "";
        // 去掉「 - 当前推荐」后缀
        title.textContent = label;
        title.classList.remove("current");
    });
}

function resetChannelRecommendMarks() {
    // 只恢复文案与样式，href 由渲染期一次性写入，之后不再从 data-* 回写
    document.querySelectorAll(".channel-item").forEach((li) => {
        li.classList.remove("is-recommend");
        const a = li.querySelector("a");
        if (!a) return;
        const label = li.getAttribute("data-label") || "";
        a.textContent = label;
        a.classList.remove("current");
    });
}

function applyGroupRecommendMark(li) {
    li.classList.add("is-recommend");
    const title = li.querySelector(".group-title");
    const label = li.getAttribute("data-label") || "";
    if (title) {
        title.textContent = label + " - 当前推荐";
        title.classList.add("current");
    }
}

function applyChannelRecommendMark(li) {
    li.classList.add("is-recommend");
    const a = li.querySelector("a");
    const label = li.getAttribute("data-label") || "";
    if (a) {
        a.textContent = label + " - 当前推荐";
        a.classList.add("current");
    }
}

function markPlatformRecommend(platform) {
    resetGroupRecommendMarks();
    resetChannelRecommendMarks();

    const listsPlaceholder = document.getElementById("listsPlaceholder");
    if (listsPlaceholder) listsPlaceholder.classList.add("is-hidden");

    document.querySelectorAll(".group-section").forEach((sec) => {
        sec.classList.toggle("is-active", sec.getAttribute("data-platform") === platform);
    });

    // 频道：只展示当前平台
    const channelPlaceholder = document.getElementById("channelPlaceholder");
    const channelBlock = document.getElementById("channelBlock");
    let hasChannel = false;
    document.querySelectorAll(".channel-item").forEach((li) => {
        const match = li.getAttribute("data-platform") === platform;
        li.classList.toggle("is-active", match);
        if (match) hasChannel = true;
    });
    if (channelPlaceholder) {
        channelPlaceholder.classList.toggle("is-hidden", hasChannel);
        if (!hasChannel) {
            channelPlaceholder.textContent = "该平台暂无 QQ 频道";
        }
    }
    if (channelBlock) {
        channelBlock.classList.toggle("is-empty", !hasChannel);
    }

    document
        .querySelectorAll('.group-item[data-platform="' + platform + '"][data-recommend="1"]')
        .forEach(applyGroupRecommendMark);
    document
        .querySelectorAll('.channel-item[data-platform="' + platform + '"][data-recommend="1"]')
        .forEach(applyChannelRecommendMark);
}

function normalizePlatform(raw) {
    if (!raw) return "";
    const s = String(raw).trim().toLowerCase();
    const map = {
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
    };
    return map[s] || "";
}

function platformFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const keys = ["platform", "os", "p", "client"];
        for (let i = 0; i < keys.length; i++) {
            const v = normalizePlatform(params.get(keys[i]));
            if (v && RECOMMENDS[v]) return v;
        }
        // 兼容 #windows / #mac / #platform=android
        const hash = (window.location.hash || "").replace(/^#/, "");
        if (hash) {
            let h = hash;
            const eq = hash.indexOf("=");
            if (eq >= 0) h = hash.slice(eq + 1);
            const v = normalizePlatform(h);
            if (v && RECOMMENDS[v]) return v;
        }
    } catch (e) {}
    return "";
}

function syncPlatformToUrl(platform) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("platform", platform);
        ["os", "p", "client"].forEach((k) => url.searchParams.delete(k));
        const next = url.pathname + url.search + (url.hash || "");
        if (next !== window.location.pathname + window.location.search + window.location.hash) {
            history.replaceState(null, "", next);
        }
    } catch (e) {}
}

function selectPlatform(platform, options) {
    const rec = RECOMMENDS[platform];
    if (!rec) return;
    options = options || {};

    // 主动点选平台视为新意图：重新开启自动跳转
    userCancelled = false;
    currentPlatform = platform;

    document.querySelectorAll(".platform-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-platform") === platform);
    });

    markPlatformRecommend(platform);
    clearHeaderRecExtra();
    // 异步拉头像/人数；失败静默，不展示
    loadPlatformGroupInfo(platform);

    const title = document.getElementById("join-title");
    const gidEl = document.getElementById("join-gid");
    const primary = document.getElementById("primaryLink");
    const btnText = primary.querySelector(".btn-text");
    const label = PLATFORM_LABELS[platform] || platform;
    const isChannel = rec.kind === "channel";

    if (isChannel) {
        title.textContent = "欢迎加入【" + rec.name + "】（" + label + "）";
        gidEl.style.display = "none";
        if (btnText) btnText.textContent = "立即加入 QQ 频道";
    } else {
        title.textContent = "欢迎加入【" + rec.name + "】（" + label + "）";
        if (rec.gid) {
            gidEl.style.display = "";
            gidEl.replaceChildren();
            gidEl.appendChild(document.createTextNode("群号: "));
            const strong = document.createElement("strong");
            strong.textContent = String(rec.gid);
            gidEl.appendChild(strong);
        } else {
            gidEl.style.display = "none";
        }
        if (btnText) btnText.textContent = "立即加入当前推荐群组";
    }

    primary.href = rec.url;
    primary.classList.remove("is-disabled");
    primary.setAttribute("aria-disabled", "false");
    if (!options.skipUrlSync) {
        syncPlatformToUrl(platform);
    }
    startRedirect(rec.url);
}

// URL 带平台时自动选中，无需手动点
// 例: ?platform=windows  ?os=android  ?p=mac  #windows
function initPlatformFromUrl() {
    const p = platformFromUrl();
    if (p) selectPlatform(p, { skipUrlSync: true });
}

function bindStaticHandlers() {
    document.querySelectorAll(".platform-tab").forEach((btn) => {
        btn.addEventListener("click", () => selectPlatform(btn.getAttribute("data-platform")));
    });
    const primary = document.getElementById("primaryLink");
    if (primary) primary.addEventListener("click", handlePrimaryLinkClick);
}

async function boot() {
    bindStaticHandlers();
    try {
        const resp = await fetch("data.json", { cache: "no-cache" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        applyData(await resp.json());
        initPlatformFromUrl();
    } catch (e) {
        document.getElementById("listsPlaceholder").textContent = "群组数据加载失败，请稍后刷新重试。";
        document.getElementById("channelBlock").hidden = true;
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
