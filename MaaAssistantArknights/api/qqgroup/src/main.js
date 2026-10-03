// 运行时只从 join.maameow.com 拉人数与头像，群组/频道配置构建期已打进 bundle。
import windowsTxt from "./data/content_windows.txt?raw";
import androidTxt from "./data/content_android.txt?raw";
import macTxt from "./data/content_mac.txt?raw";
import channelsTxt from "./data/content_channels.txt?raw";
import RECOMMENDS from "./data/recommend.json";
import { PLATFORM_LABELS, GROUPINFO_API, buildPlatformsFromTexts } from "./shared/content.mjs";

const PLATFORMS = Object.keys(PLATFORM_LABELS);
const DATA = {
    platforms: buildPlatformsFromTexts({
        content_windows: windowsTxt,
        content_android: androidTxt,
        content_mac: macTxt,
        content_channels: channelsTxt,
    }),
};

const groupInfoCache = Object.create(null); // gid -> info | null(failed)

// 外部数据一律走 textContent / 属性赋值，不碰 innerHTML
function tpl(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function tplFrag(id) {
    return document.getElementById(id).content.cloneNode(true);
}

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
        // 只换链接，不重开倒计时
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
        text.replaceChildren(tplFrag("tplRedirectText"));
        text.querySelector("#countdown").textContent = String(countdown);
        const cancelBtn = text.querySelector("#cancelBtn");
        // 模板里按钮换行写了，要去掉首尾空白
        cancelBtn.textContent = cancelBtn.textContent.trim();
        cancelBtn.addEventListener("click", cancelRedirect);
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
    if (!el) return false;
    const max = info && info.known ? info.max_member_count : 0;
    if (!max || max <= 0) {
        el.replaceChildren();
        el.hidden = true;
        return false;
    }
    const free = typeof info.free_slots === "number" ? info.free_slots : Math.max(0, max - info.member_count);
    const span = tpl("tplMemberChip");
    span.className = free <= 0 ? "full" : "ok";
    span.textContent = `${info.member_count} / ${max} · ${free <= 0 ? "已满" : "余 " + free}`;
    el.replaceChildren(span);
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
    await fetchGroupInfoBatch(unique, (partIds) => {
        if (currentPlatform === platform) applyPlatformInfoForIds(platform, partIds, recGid);
    });
}

function isGroupRecommend(rec, g) {
    return !!rec && rec.kind === "group" && String(rec.gid) === String(g.gid);
}

function buildGroupItem(platform, g, rec) {
    const gid = String(g.gid || "");
    const li = tpl(g.active ? "tplGroupItemActive" : "tplGroupItemDisabled");
    li.setAttribute("data-platform", platform);
    li.setAttribute("data-gid", gid);
    if (isGroupRecommend(rec, g)) li.setAttribute("data-recommend", "1");

    li.querySelector(".group-title").textContent = `${g.name || ""} (${gid})`;
    const link = li.querySelector(".group-link"); // 停用群没有 <a>
    if (link) link.href = g.url;
    return li;
}

function buildChannelItem(platform, ch, rec) {
    const li = tpl("tplChannelItem");
    li.setAttribute("data-platform", platform);
    if (rec && rec.kind === "channel") li.setAttribute("data-recommend", "1");
    const a = li.querySelector("a");
    a.textContent = ch.name || "";
    a.href = ch.url;
    return li;
}

function buildGroupSection(p, pd, groups, rec) {
    const valid = groups.filter((g) => g.active).length;
    const section = tpl("tplGroupSection");
    section.id = "section-" + p;
    section.setAttribute("data-platform", p);
    section.querySelector(".group-label").textContent = `${pd.label || p} 群组`;
    section.querySelector(".group-count").textContent = `共 ${valid} 个`;
    const ul = section.querySelector(".group-list");
    ul.replaceChildren(...groups.map((g) => buildGroupItem(p, g, rec)));
    return section;
}

function renderLists() {
    const platforms = DATA.platforms || {};
    const hasAnyChannel = PLATFORMS.some((p) => platforms[p] && platforms[p].channel);
    const anyChannelRec = PLATFORMS.some((p) => RECOMMENDS[p] && RECOMMENDS[p].kind === "channel");

    const header = document.getElementById("join-header");
    if (header) header.classList.toggle("channel-header", anyChannelRec);
    const channelBlock = document.getElementById("channelBlock");
    if (channelBlock) channelBlock.style.display = hasAnyChannel ? "" : "none";

    const channelItems = [];
    for (const p of PLATFORMS) {
        const pd = platforms[p];
        if (pd && pd.channel) channelItems.push(buildChannelItem(p, pd.channel, RECOMMENDS[p]));
    }
    const channelList = document.getElementById("channelList");
    if (channelList) channelList.replaceChildren(...channelItems);

    const sections = [];
    for (const p of PLATFORMS) {
        const pd = platforms[p];
        if (pd) sections.push(buildGroupSection(p, pd, pd.groups || [], RECOMMENDS[p]));
    }
    const sectionsEl = document.getElementById("groupSections");
    if (sectionsEl) sectionsEl.replaceChildren(...sections);
}

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
    // 「- 当前推荐」后缀由 CSS ::after 生成，JS 只切 class
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
    if (title) title.textContent = `欢迎加入【${rec.name}】（${label}）`;

    const gidEl = document.getElementById("join-gid");
    const gidValueEl = document.getElementById("join-gid-value");
    if (gidEl) {
        if (!isChannel && rec.gid) {
            if (gidValueEl) gidValueEl.textContent = String(rec.gid);
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

function wireStaticControls() {
    document.querySelectorAll(".platform-tab").forEach((btn) => {
        btn.addEventListener("click", () => selectPlatform(btn.dataset.platform));
    });
    const primary = document.getElementById("primaryLink");
    if (primary) primary.addEventListener("click", handlePrimaryLinkClick);
    document.addEventListener("click", (e) => {
        if (e.target.closest(".group-link, .channel-item a")) handleLinkClick();
    });
}

// URL 带平台时直接选中：?platform=windows / ?os=android / ?p=mac / #windows
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
