import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# 产出 data.json：群列表、频道、各平台推荐。页面本体（index.html / styles.css /
# main.js）是静态的，前端 fetch data.json 后渲染。
#
# 使用：
#   python gen_index.py                          - 三平台粘性自动
#   python gen_index.py auto                     - 同上
#   python gen_index.py windows auto             - 只刷新 Windows（其它平台保持状态，不查人数）
#   python gen_index.py android 2                - 手动钉 Android 第 2 群
#   python gen_index.py windows channel          - Windows 推 QQ 频道
#   python gen_index.py 28                       - 兼容：等同 windows 28
#   python gen_index.py channel                  - 兼容：等同 windows channel
#
# 自动策略（粘性，仅对「本次操作的平台」生效）：
#   1. 从现有 data.json 的 recommends 读取上次推荐群
#   2. 只查当前推荐是否满员；未满 / 查失败 → 保持
#   3. 已满 / 已下架 → 按列表顺序选「第一个有空位」的群
#   4. 写回 data.json（粘性状态就在 recommends 里，无额外文件）
#
# 运营配置：
#   content_windows.txt / content_android.txt / content_mac.txt
#     每行: 加群链接|群名称|群号
#   content_channels.txt
#     每行: 平台|频道链接|频道名称   （# 开头为注释）
#
# 环境变量 GROUPINFO_API 可覆盖自动选群用的接口（默认 join.maameow.com）

CHANNELS_FILE = "content_channels.txt"
DATA_FILE = "data.json"
GROUPINFO_API = os.environ.get(
    "GROUPINFO_API", "https://join.maameow.com/api/groupinfo"
).rstrip("/")
# 换群时分批查人数，每批找到有空位的就停
OCCUPANCY_BATCH = 5

PLATFORMS = ("windows", "android", "mac")
PLATFORM_FILES = {
    "windows": "content_windows.txt",
    "android": "content_android.txt",
    "mac": "content_mac.txt",
}
PLATFORM_LABELS = {
    "windows": "Windows",
    "android": "Android",
    "mac": "Mac",
}
# 兼容别名
PLATFORM_ALIASES = {
    "win": "windows",
    "windows": "windows",
    "android": "android",
    "mac": "mac",
    "macos": "mac",
}


def load_groups(path: Path) -> list[dict]:
    if not path.is_file():
        raise FileNotFoundError(f"找不到群配置文件: {path}")
    groups = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) < 3:
                raise ValueError(f"配置行格式错误 ({path.name}): {line!r}")
            url, name, gid = parts[0], parts[1], parts[2]
            groups.append(
                {
                    "url": url,
                    "name": name,
                    "gid": gid,
                    "active": url.startswith("http"),
                }
            )
    if not groups:
        raise ValueError(f"群配置文件没有任何有效群行: {path.name}")
    return groups


def load_channels(path: Path) -> dict[str, dict]:
    """返回 platform -> {url, name}。文件不存在则空 dict。"""
    channels: dict[str, dict] = {}
    if not path.is_file():
        return channels
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) < 3:
                raise ValueError(f"频道配置行格式错误 ({path.name}): {line!r}")
            platform_raw, url, name = parts[0].strip().lower(), parts[1].strip(), parts[2].strip()
            platform = PLATFORM_ALIASES.get(platform_raw)
            if not platform:
                raise ValueError(
                    f"未知平台 {platform_raw!r}，应为: {', '.join(PLATFORMS)}"
                )
            if not url.startswith("http"):
                raise ValueError(f"频道链接无效: {url!r}")
            channels[platform] = {"url": url, "name": name}
    return channels


def parse_args(argv: list[str]) -> dict:
    """解析命令行，返回生成计划。

    返回 dict:
      touch: 本次要刷新的平台集合（其它平台 freeze 保持状态、不查人数）
      mode:  platform -> "auto" | "manual" | "channel" | "freeze"
      manual: platform -> 1-based 群编号（仅 manual）
    """
    usage = (
        "用法:\n"
        "  python gen_index.py                         # 三平台粘性自动\n"
        "  python gen_index.py auto\n"
        "  python gen_index.py windows auto            # 只刷新 Windows\n"
        "  python gen_index.py android 2               # 手动钉 Android #2\n"
        "  python gen_index.py windows channel         # 该平台推 QQ 频道\n"
        "  python gen_index.py 28                      # 兼容：windows 手动 #28\n"
        "  python gen_index.py channel                 # 兼容：windows channel"
    )

    def plan(
        touch: set[str],
        *,
        mode_for_touch: str = "auto",
        manual: dict[str, int] | None = None,
        channel_platforms: set[str] | None = None,
    ) -> dict:
        modes = {p: "freeze" for p in PLATFORMS}
        for p in touch:
            modes[p] = mode_for_touch
        if channel_platforms:
            for p in channel_platforms:
                modes[p] = "channel"
                touch.add(p)
        man = manual or {}
        for p, n in man.items():
            modes[p] = "manual"
            touch.add(p)
        return {"touch": set(touch), "mode": modes, "manual": man}

    if not argv:
        return plan(set(PLATFORMS), mode_for_touch="auto")

    if len(argv) == 1 and argv[0].lower() in ("auto", "sticky"):
        return plan(set(PLATFORMS), mode_for_touch="auto")

    if len(argv) == 1 and argv[0].lower() == "channel":
        return plan({"windows"}, mode_for_touch="channel", channel_platforms={"windows"})

    # 单个数字：兼容旧习惯 → 只钉 Windows
    if len(argv) == 1 and argv[0].isdigit():
        n = int(argv[0])
        if n == 0:
            return plan({"windows"}, mode_for_touch="channel", channel_platforms={"windows"})
        return plan({"windows"}, mode_for_touch="manual", manual={"windows": n})

    # 平台 + 动作：windows auto | android 2 | mac channel
    if len(argv) == 2:
        p_raw, action = argv[0].lower(), argv[1].lower()
        if p_raw in ("all", "every"):
            platform_set = set(PLATFORMS)
        elif p_raw in PLATFORM_ALIASES:
            platform_set = {PLATFORM_ALIASES[p_raw]}
        else:
            platform_set = set()
        if platform_set:
            if action in ("auto", "sticky"):
                return plan(platform_set, mode_for_touch="auto")
            if action == "channel":
                return plan(platform_set, mode_for_touch="channel", channel_platforms=set(platform_set))
            if action.isdigit():
                n = int(action)
                if n == 0:
                    return plan(
                        platform_set,
                        mode_for_touch="channel",
                        channel_platforms=set(platform_set),
                    )
                if len(platform_set) != 1:
                    raise SystemExit("手动编号只能针对单个平台，例如: windows 28")
                only = next(iter(platform_set))
                return plan(platform_set, mode_for_touch="manual", manual={only: n})
            raise SystemExit(usage)

    # 关键字多段：windows 28 android auto mac channel
    if argv:
        touch: set[str] = set()
        modes: dict[str, str] = {p: "freeze" for p in PLATFORMS}
        manual: dict[str, int] = {}
        i = 0
        while i < len(argv):
            token = argv[i].lower()
            if token in ("auto", "sticky") and i == 0 and len(argv) == 1:
                return plan(set(PLATFORMS), mode_for_touch="auto")
            if token in PLATFORM_ALIASES:
                p = PLATFORM_ALIASES[token]
                if i + 1 >= len(argv):
                    raise SystemExit(f"需要为 {token} 指定 auto / channel / 群编号")
                action = argv[i + 1].lower()
                touch.add(p)
                if action in ("auto", "sticky"):
                    modes[p] = "auto"
                elif action == "channel":
                    modes[p] = "channel"
                elif action.isdigit():
                    n = int(action)
                    if n == 0:
                        modes[p] = "channel"
                    else:
                        modes[p] = "manual"
                        manual[p] = n
                else:
                    raise SystemExit(f"未知动作 {action!r}，应为 auto / channel / 数字")
                i += 2
                continue
            if token == "channel":
                touch.add("windows")
                modes["windows"] = "channel"
                i += 1
                continue
            raise SystemExit(usage)
        if touch:
            return {"touch": touch, "mode": modes, "manual": manual}

    raise SystemExit(usage)


def freeze_recommend(
    groups: list[dict],
    platform: str,
    sticky_gid: str | None,
) -> tuple[dict, int, str]:
    """未选中的平台：沿用状态，不查人数。"""
    label = PLATFORM_LABELS[platform]
    if sticky_gid:
        idx = index_of_gid(groups, sticky_gid)
        if idx is not None and groups[idx].get("active"):
            g = groups[idx]
            print(
                f"保持[{label}]: #{idx + 1} {g['name']}（本轮未选中，不查人数）",
                file=sys.stderr,
            )
            return (
                {"url": g["url"], "name": g["name"], "gid": g["gid"], "kind": "group"},
                idx,
                f"keep#{idx + 1}",
            )
        if idx is not None:
            print(
                f"保持[{label}]: 状态群已下架，改用第一个可用群",
                file=sys.stderr,
            )
    for i, g in enumerate(groups):
        if g.get("active"):
            print(
                f"保持[{label}]: 无有效粘性，回退 #{i + 1} {g['name']}",
                file=sys.stderr,
            )
            return (
                {"url": g["url"], "name": g["name"], "gid": g["gid"], "kind": "group"},
                i,
                f"keep-fallback#{i + 1}",
            )
    g = groups[0]
    return (
        {"url": g["url"], "name": g["name"], "gid": g["gid"], "kind": "group"},
        0,
        "keep-fallback#1",
    )


def pick_recommend(groups: list[dict], index_1based: int, platform: str) -> dict:
    idx = index_1based - 1
    if idx < 0 or idx >= len(groups):
        raise ValueError(
            f"{PLATFORM_LABELS[platform]} 推荐群编号超出范围: "
            f"{index_1based}（共 {len(groups)} 个）"
        )
    return groups[idx]


def fetch_group_occupancy(gids: list[str]) -> dict[str, dict]:
    """批量查询 groupinfo；失败返回空 dict（调用方走降级）。"""
    out: dict[str, dict] = {}
    if not gids:
        return out
    # API 单次最多 20
    for i in range(0, len(gids), 20):
        part = gids[i : i + 20]
        url = f"{GROUPINFO_API}?ids={urllib.parse.quote(','.join(part))}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "MaaRelease-gen_index/1.0", "Accept": "application/json"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8", errors="replace"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            print(f"自动选群: groupinfo 查询失败 ({e})，将降级", file=sys.stderr)
            continue
        if not isinstance(body, dict) or body.get("code") != 0:
            continue
        data = body.get("data")
        if isinstance(data, dict) and "groups" in data:
            items = data.get("groups") or []
        elif isinstance(data, dict) and data.get("group_id"):
            items = [data]
        else:
            items = []
        for g in items:
            if not isinstance(g, dict):
                continue
            gid = str(g.get("group_id") or "")
            if gid:
                out[gid] = g
    return out


def free_slots_of(info: dict | None) -> int | None:
    """有 known 数据时返回空位数；否则 None。"""
    if not info or not info.get("known"):
        return None
    free = info.get("free_slots")
    if free is not None:
        return max(0, int(free))
    mx = int(info.get("max_member_count") or 0)
    cur = int(info.get("member_count") or 0)
    if mx <= 0:
        return None
    return max(0, mx - cur)


def _pick_sticky(recommends) -> dict[str, dict]:
    """从 recommends（platform -> 群推荐）里挑出可粘性的项。"""
    out: dict[str, dict] = {}
    if not isinstance(recommends, dict):
        return out
    for p, rec in recommends.items():
        if p not in PLATFORMS or not isinstance(rec, dict):
            continue
        # 仅群推荐带 gid；频道模式没有可粘性的群号
        if rec.get("kind") == "group" and rec.get("gid"):
            out[p] = {"gid": str(rec["gid"]), "name": rec.get("name") or ""}
    return out


def load_sticky(data_path: Path) -> dict[str, dict]:
    """读取粘性推荐（platform -> {gid, name}），来源优先级 data.json > 旧 index.html。"""
    if data_path.is_file():
        try:
            data = json.loads(data_path.read_text(encoding="utf-8"))
            return _pick_sticky(data.get("recommends") if isinstance(data, dict) else None)
        except (OSError, json.JSONDecodeError) as e:
            print(f"解析 {DATA_FILE} 失败 ({e})，忽略粘性", file=sys.stderr)

    legacy_index = data_path.parent / "index.html"
    if not legacy_index.is_file():
        return {}
    try:
        text = legacy_index.read_text(encoding="utf-8")
    except OSError:
        return {}
    marker = "const RECOMMENDS = "
    start = text.find(marker)
    if start < 0:
        return {}
    start += len(marker)
    end = text.find(";", start)
    if end < 0:
        return {}
    try:
        return _pick_sticky(json.loads(text[start:end].strip()))
    except json.JSONDecodeError as e:
        print(f"解析旧 index.html RECOMMENDS 失败 ({e})，忽略粘性", file=sys.stderr)
        return {}


def index_of_gid(groups: list[dict], gid: str) -> int | None:
    gid = str(gid)
    for i, g in enumerate(groups):
        if str(g["gid"]) == gid:
            return i
    return None


def first_with_free_slots(groups: list[dict], platform: str) -> int:
    """按列表顺序找第一个有空位的 active 群；分批查询，找到即停。"""
    active = [(i, g) for i, g in enumerate(groups) if g.get("active")]
    if not active:
        print(
            f"自动选群[{PLATFORM_LABELS[platform]}]: 无可用群，回退索引 0",
            file=sys.stderr,
        )
        return 0

    label = PLATFORM_LABELS[platform]
    checked = 0
    for start in range(0, len(active), OCCUPANCY_BATCH):
        batch = active[start : start + OCCUPANCY_BATCH]
        occ = fetch_group_occupancy([g["gid"] for _, g in batch])
        for i, g in batch:
            checked += 1
            free = free_slots_of(occ.get(str(g["gid"])))
            if free is None:
                print(
                    f"自动选群[{label}]: #{i + 1} {g['name']} 人数未知，跳过",
                    file=sys.stderr,
                )
                continue
            if free > 0:
                print(
                    f"自动选群[{label}]: 选中第一个有空位 "
                    f"#{i + 1} {g['name']} 余{free}"
                    f"（已查 {checked} 个）",
                    file=sys.stderr,
                )
                return i
            print(
                f"自动选群[{label}]: #{i + 1} {g['name']} 已满，继续",
                file=sys.stderr,
            )

    fb = active[0][0]
    print(
        f"自动选群[{label}]: 未找到确认有空位的群，回退第一个可用 "
        f"#{fb + 1} {groups[fb]['name']}",
        file=sys.stderr,
    )
    return fb


def sticky_auto_recommend_index(
    groups: list[dict],
    platform: str,
    sticky_gid: str | None,
) -> tuple[int, str]:
    """粘性自动：未满保持；满了/下架则按序选第一个有空位。返回 (0-based, source)。"""
    label = PLATFORM_LABELS[platform]
    active = [(i, g) for i, g in enumerate(groups) if g.get("active")]
    if not active:
        return 0, "auto#1-empty"

    sticky_i: int | None = None
    if sticky_gid:
        sticky_i = index_of_gid(groups, sticky_gid)
        if sticky_i is None:
            print(
                f"粘性[{label}]: 状态群 {sticky_gid} 不在配置中，重新选群",
                file=sys.stderr,
            )
        elif not groups[sticky_i].get("active"):
            print(
                f"粘性[{label}]: #{sticky_i + 1} {groups[sticky_i]['name']} 已下架，重新选群",
                file=sys.stderr,
            )
            sticky_i = None

    if sticky_i is not None:
        g = groups[sticky_i]
        occ = fetch_group_occupancy([g["gid"]])
        free = free_slots_of(occ.get(str(g["gid"])))
        if free is None:
            # 查失败：保持旧推荐，避免乱跳
            print(
                f"粘性[{label}]: 保持 #{sticky_i + 1} {g['name']}（人数暂不可用）",
                file=sys.stderr,
            )
            return sticky_i, f"sticky#{sticky_i + 1}-keep-unknown"
        if free > 0:
            print(
                f"粘性[{label}]: 保持 #{sticky_i + 1} {g['name']} 余{free}",
                file=sys.stderr,
            )
            return sticky_i, f"sticky#{sticky_i + 1}"
        print(
            f"粘性[{label}]: #{sticky_i + 1} {g['name']} 已满，按序选第一个有空位",
            file=sys.stderr,
        )

    idx = first_with_free_slots(groups, platform)
    return idx, f"auto-first-free#{idx + 1}"


def resolve_recommend(
    platform: str,
    groups: list[dict],
    *,
    mode: str,
    manual_1based: int | None,
    channel: dict | None,
    sticky_gid: str | None,
) -> tuple[dict, int, str]:
    """返回 (recommend字典, recommendIndex 0-based, 来源说明)。"""
    if mode == "freeze":
        return freeze_recommend(groups, platform, sticky_gid)

    if mode == "channel":
        if channel:
            return (
                {
                    "url": channel["url"],
                    "name": channel["name"],
                    "gid": "",
                    "kind": "channel",
                },
                -1,
                "channel",
            )
        print(
            f"{PLATFORM_LABELS[platform]}: 无频道配置，回退粘性自动",
            file=sys.stderr,
        )
        mode = "auto"

    if mode == "manual":
        if manual_1based is None:
            raise ValueError(f"{PLATFORM_LABELS[platform]} manual 模式缺少群编号")
        rec = pick_recommend(groups, manual_1based, platform)
        return (
            {"url": rec["url"], "name": rec["name"], "gid": rec["gid"], "kind": "group"},
            manual_1based - 1,
            f"manual#{manual_1based}",
        )

    # auto：粘性
    idx, source = sticky_auto_recommend_index(groups, platform, sticky_gid)
    rec = groups[idx]
    return (
        {"url": rec["url"], "name": rec["name"], "gid": rec["gid"], "kind": "group"},
        idx,
        source,
    )


def main() -> None:
    base = Path(__file__).resolve().parent
    plan = parse_args(sys.argv[1:])
    channels = load_channels(base / CHANNELS_FILE)

    data_path = base / DATA_FILE
    sticky = load_sticky(data_path)
    if sticky:
        source = DATA_FILE if data_path.is_file() else "旧 index.html"
        print(
            f"从 {source} 读取粘性: "
            + ", ".join(f"{p}={sticky[p].get('gid')}" for p in sticky),
            file=sys.stderr,
        )
    else:
        print("无可用粘性状态（首次生成或尚无群推荐）", file=sys.stderr)

    legacy_state = base / "recommend_state.json"
    if legacy_state.is_file():
        try:
            legacy_state.unlink()
            print("已删除遗留 recommend_state.json", file=sys.stderr)
        except OSError as e:
            print(f"删除 recommend_state.json 失败: {e}", file=sys.stderr)

    touch = plan["touch"]
    print(
        "本轮操作平台: "
        + (", ".join(PLATFORM_LABELS[p] for p in PLATFORMS if p in touch) or "(无)"),
        file=sys.stderr,
    )

    platforms_data: dict[str, dict] = {}
    for platform in PLATFORMS:
        groups = load_groups(base / PLATFORM_FILES[platform])
        ch = channels.get(platform)
        sticky_gid = None
        entry = sticky.get(platform)
        if entry:
            sticky_gid = str(entry.get("gid") or "") or None
        mode = plan["mode"].get(platform, "freeze")
        manual_n = plan["manual"].get(platform)
        recommend, rec_index, source = resolve_recommend(
            platform,
            groups,
            mode=mode,
            manual_1based=manual_n,
            channel=ch,
            sticky_gid=sticky_gid,
        )
        platforms_data[platform] = {
            "label": PLATFORM_LABELS[platform],
            "recommendIndex": rec_index,
            "recommend": recommend,
            "recommendSource": source,
            "groups": groups,
            "validCount": sum(1 for g in groups if g["active"]),
            "channel": ch,
        }

    data = {
            "recommends": {
                p: {
                    "url": platforms_data[p]["recommend"]["url"],
                    "name": platforms_data[p]["recommend"]["name"],
                    "gid": platforms_data[p]["recommend"]["gid"],
                    "kind": platforms_data[p]["recommend"]["kind"],
                }
                for p in PLATFORMS
            },
            "channels": {
                p: (
                    {"url": platforms_data[p]["channel"]["url"], "name": platforms_data[p]["channel"]["name"]}
                    if platforms_data[p]["channel"]
                    else None
                )
                for p in PLATFORMS
            },
            "groupinfo_api": GROUPINFO_API,
            "platforms": {
                p: {
                    "label": platforms_data[p]["label"],
                    "validCount": platforms_data[p]["validCount"],
                    "groups": platforms_data[p]["groups"],
                }
                for p in PLATFORMS
            },
        }

    out = data_path
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    parts = []
    for p in PLATFORMS:
        rec = platforms_data[p]["recommend"]
        src = platforms_data[p].get("recommendSource", "")
        if rec["kind"] == "channel":
            kind = f"频道/{src}"
        else:
            kind = src or f"#{platforms_data[p]['recommendIndex'] + 1}"
        parts.append(f"{PLATFORM_LABELS[p]}:{kind}({rec['name']})")
    mode = " / ".join(parts)

    print(f"已更新 {out.name} → {mode}")
    for p in PLATFORMS:
        ch = platforms_data[p]["channel"]
        ch_info = f", 频道 {ch['name']}" if ch else ", 无频道"
        print(
            f"  - {PLATFORM_LABELS[p]}: {platforms_data[p]['validCount']} 个群"
            f", 推荐来源 {platforms_data[p].get('recommendSource')}"
            f", 配置 {PLATFORM_FILES[p]}{ch_info}"
        )
    print(f"  - 频道配置: {CHANNELS_FILE} ({len(channels)} 个平台)")
    print(f"  - 粘性状态: {DATA_FILE} recommends")


if __name__ == "__main__":
    main()