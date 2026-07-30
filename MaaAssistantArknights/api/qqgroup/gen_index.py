import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# 使用：
#   python gen_index.py 28                       - Windows 推荐第 28 群（CI 同款）
#                                                  Android / Mac 自动选（人数有空位优先）
#   python gen_index.py channel                  - Windows 推荐 QQ 频道；Android/Mac 仍自动选群
#   python gen_index.py                          - Windows 默认第 1 群；Android/Mac 自动
#   python gen_index.py windows 28               - 只指定 Windows
#   python gen_index.py windows 28 android 2     - 可选：手动覆盖 Android/Mac（调试用）
#
# 运营配置：
#   content_windows.txt / content_android.txt / content_mac.txt
#     每行: 加群链接|群名称|群号
#   content_channels.txt
#     每行: 平台|频道链接|频道名称   （# 开头为注释）
#
# 环境变量 GROUPINFO_API 可覆盖自动选群用的接口（默认 join.maameow.com）

CHANNELS_FILE = "content_channels.txt"
GROUPINFO_API = os.environ.get(
    "GROUPINFO_API", "https://join.maameow.com/api/groupinfo"
).rstrip("/")
# 仅 Windows 由 CI/参数指定推荐；Android、Mac 默认自动
AUTO_PLATFORMS = frozenset({"android", "mac"})

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


def parse_args(argv: list[str]) -> tuple[dict[str, int | None], bool]:
    """返回 (各平台 1-based 推荐编号或 None=自动, 是否 Windows 频道模式)。

    None 表示该平台用自动选群。CI 只传一个数字时仅设置 Windows。
    """
    # Windows 无参时默认第 1 群；Android/Mac 默认自动
    recommends: dict[str, int | None] = {
        "windows": 1,
        "android": None,
        "mac": None,
    }
    is_channel = False

    if not argv:
        return recommends, False

    if len(argv) == 1 and argv[0].lower() == "channel":
        # Windows 走频道；Android/Mac 仍自动选群
        recommends["windows"] = None
        return recommends, True

    # 单个数字：兼容旧 CI → 只改 Windows
    if len(argv) == 1 and argv[0].isdigit():
        recommends["windows"] = int(argv[0])
        return recommends, False

    # 多个纯数字：仅第一个作为 Windows（Android/Mac 保持自动，避免误伤）
    if all(a.isdigit() for a in argv) and 1 <= len(argv) <= 3:
        recommends["windows"] = int(argv[0])
        if len(argv) >= 2:
            print(
                "提示: 位置参数仅 Windows 生效；"
                f"已忽略多余参数 {argv[1:]!r}。"
                "若需手动指定 Android/Mac，请用: android 2 mac 1",
                file=sys.stderr,
            )
        return recommends, False

    # 关键字参数：windows 28 [android 2] [mac 1] [channel]
    i = 0
    while i < len(argv):
        token = argv[i].lower()
        if token == "channel":
            is_channel = True
            recommends["windows"] = None
            i += 1
            continue
        if token in PLATFORM_ALIASES:
            if i + 1 >= len(argv) or not argv[i + 1].isdigit():
                raise SystemExit(f"需要为 {token} 指定群编号，例如: {token} 1")
            recommends[PLATFORM_ALIASES[token]] = int(argv[i + 1])
            i += 2
            continue
        raise SystemExit(
            "用法:\n"
            "  python gen_index.py <Windows群编号>     # CI：只改 Windows，Android/Mac 自动\n"
            "  python gen_index.py channel            # Windows 推频道，Android/Mac 自动选群\n"
            "  python gen_index.py windows 28\n"
            "  python gen_index.py windows 28 android 2 mac 1   # 调试可手动覆盖"
        )

    return recommends, is_channel


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


def auto_recommend_index(groups: list[dict], platform: str) -> int:
    """自动选推荐群（0-based）：有空位的优先，空位多者优先；失败则第一个可用群。"""
    active = [(i, g) for i, g in enumerate(groups) if g.get("active")]
    if not active:
        print(f"自动选群[{PLATFORM_LABELS[platform]}]: 无可用群，回退索引 0", file=sys.stderr)
        return 0

    gids = [g["gid"] for _, g in active]
    occ = fetch_group_occupancy(gids)

    best_i = active[0][0]
    best_key = (-1, -1)  # (has_info, free_slots) — 无数据时 has_info=0
    detail = []
    for i, g in active:
        info = occ.get(str(g["gid"]))
        if not info or not info.get("known"):
            detail.append(f"#{i + 1} {g['name']}=未知")
            continue
        free = info.get("free_slots")
        if free is None:
            mx = int(info.get("max_member_count") or 0)
            cur = int(info.get("member_count") or 0)
            free = max(0, mx - cur) if mx > 0 else 0
        free = int(free)
        key = (1, free)
        cur = info.get("member_count")
        mx = info.get("max_member_count")
        detail.append(
            f"#{i + 1} {g['name']}="
            f"{cur if cur is not None else '?'}/{mx if mx is not None else '?'} 余{free}"
        )
        if key > best_key:
            best_key = key
            best_i = i

    if best_key[0] < 0:
        print(
            f"自动选群[{PLATFORM_LABELS[platform]}]: 人数均未知，使用第一个可用群 "
            f"#{active[0][0] + 1} {active[0][1]['name']}",
            file=sys.stderr,
        )
        return active[0][0]

    print(
        f"自动选群[{PLATFORM_LABELS[platform]}]: 选中 #{best_i + 1} {groups[best_i]['name']} "
        f"(空位优先) | " + "; ".join(detail),
        file=sys.stderr,
    )
    return best_i


def resolve_recommend(
    platform: str,
    groups: list[dict],
    specified_1based: int | None,
    *,
    windows_channel_mode: bool,
    channel: dict | None,
) -> tuple[dict, int, str]:
    """返回 (recommend字典, recommendIndex 0-based, 来源说明)。"""
    # Windows 频道模式
    if platform == "windows" and windows_channel_mode and channel:
        return (
            {"url": channel["url"], "name": channel["name"], "gid": "", "kind": "channel"},
            -1,
            "channel",
        )

    if specified_1based is not None:
        rec = pick_recommend(groups, specified_1based, platform)
        return (
            {"url": rec["url"], "name": rec["name"], "gid": rec["gid"], "kind": "group"},
            specified_1based - 1,
            f"manual#{specified_1based}",
        )

    # 自动（Android / Mac，或 Windows channel 模式下无频道时）
    idx = auto_recommend_index(groups, platform)
    rec = groups[idx]
    return (
        {"url": rec["url"], "name": rec["name"], "gid": rec["gid"], "kind": "group"},
        idx,
        f"auto#{idx + 1}",
    )


def main() -> None:
    base = Path(__file__).resolve().parent
    recommends, windows_channel_mode = parse_args(sys.argv[1:])
    channels = load_channels(base / CHANNELS_FILE)

    platforms_data: dict[str, dict] = {}
    for platform in PLATFORMS:
        groups = load_groups(base / PLATFORM_FILES[platform])
        ch = channels.get(platform)
        specified = recommends.get(platform)
        # Android/Mac：除非关键字显式传入，否则强制自动（忽略误传）
        if platform in AUTO_PLATFORMS and specified is not None:
            # 仅当通过关键字 android N / mac N 传入时 keeps specified；
            # parse_args 已保证单数字不会写入 android/mac
            pass
        recommend, rec_index, source = resolve_recommend(
            platform,
            groups,
            specified,
            windows_channel_mode=windows_channel_mode,
            channel=ch,
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

    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    def render_group_items(platform: str) -> str:
        data = platforms_data[platform]
        items = []
        for i, g in enumerate(data["groups"]):
            name, gid, url = g["name"], g["gid"], g["url"]
            label = f"{esc(name)} ({esc(gid)})"
            # 仅「群推荐」时才标 data-recommend；选平台后由 JS 高亮
            is_rec = data["recommend"]["kind"] == "group" and i == data["recommendIndex"]
            rec_attr = ' data-recommend="1"' if is_rec else ""
            # 头像/人数由前端调 groupinfo API 填充；失败则保持隐藏
            row_inner = (
                f'<img class="group-avatar" alt="" width="40" height="40" hidden>'
                f'<div class="group-body">'
                f'<span class="group-title">{label}</span>'
                f'<span class="group-meta" hidden></span>'
                f"</div>"
            )
            if not g["active"]:
                items.append(
                    f'<li class="group-item" data-platform="{platform}" '
                    f'data-gid="{esc(gid)}" data-label="{label}"{rec_attr}>'
                    f'<div class="group-row disabled-row">'
                    f'{row_inner}</div></li>'
                )
            else:
                items.append(
                    f'<li class="group-item" data-platform="{platform}" '
                    f'data-gid="{esc(gid)}" data-label="{label}" '
                    f'data-href="{esc(url)}"{rec_attr}>'
                    f'<a class="group-link" href="{esc(url)}" onclick="handleLinkClick(event)">'
                    f'<div class="group-row">{row_inner}</div></a></li>'
                )
        return "\n".join(items)

    groups_sections_html = ""
    for platform in PLATFORMS:
        data = platforms_data[platform]
        groups_sections_html += f"""
        <section class="group-section" id="section-{platform}" data-platform="{platform}">
            <h3 class="group-section-title">{esc(data["label"])} 群组
                <span class="group-count">共 {data["validCount"]} 个</span>
            </h3>
            <ul class="group-list">
                {render_group_items(platform)}
            </ul>
        </section>
"""

    # 频道：按平台渲染，默认隐藏，选平台后只显示对应项
    channel_items_html = ""
    for platform in PLATFORMS:
        ch = channels.get(platform)
        if not ch:
            continue
        label = esc(ch["name"])
        url = esc(ch["url"])
        is_ch_rec = platforms_data[platform]["recommend"]["kind"] == "channel"
        rec_attr = ' data-recommend="1"' if is_ch_rec else ""
        channel_items_html += (
            f'<li class="channel channel-item" data-platform="{platform}" '
            f'data-label="{label}" data-href="{url}"{rec_attr}>'
            f'<a href="{url}" onclick="handleLinkClick(event)">{label}</a></li>\n'
        )

    header_extra = " channel-header" if windows_channel_mode else ""

    # JS 用的推荐映射（平台 → 跳转目标）
    recommend_map = {
        p: {
            "url": platforms_data[p]["recommend"]["url"],
            "name": platforms_data[p]["recommend"]["name"],
            "gid": platforms_data[p]["recommend"]["gid"],
            "kind": platforms_data[p]["recommend"]["kind"],
        }
        for p in PLATFORMS
    }
    recommend_json = json.dumps(recommend_map, ensure_ascii=False)
    # 各平台是否有频道（前端切换展示用）
    channels_meta = {
        p: ({"url": ch["url"], "name": ch["name"]} if (ch := channels.get(p)) else None)
        for p in PLATFORMS
    }
    channels_json = json.dumps(channels_meta, ensure_ascii=False)
    has_any_channel = bool(channels)
    channel_block_display = "" if has_any_channel else " style=\"display:none\""

    index_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <title>欢迎加入 MAA 交流群</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #222; }}
        .current {{ color: #ff6600; }}
        ul {{ list-style-type: none; padding: 0; }}
        li {{ margin: 12px 0; padding: 8px; background: #f9f9f9; border-radius: 5px; }}
        a {{ text-decoration: none; color: #0066cc; font-weight: bold; }}
        a:hover {{ text-decoration: underline; }}
        li > a:hover {{ color: #004499; }}
        .container {{ max-width: 800px; margin: 0 auto; }}
        .header {{ background: #eef5ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .header.channel-header {{ background: linear-gradient(135deg, #e8f0fe, #f0e6ff); }}
        .platform-row {{
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin: 12px 0 4px;
        }}
        .platform-label {{ color: #555; font-size: 0.95em; margin-right: 4px; }}
        .platform-tabs {{
            display: inline-flex;
            flex-wrap: wrap;
            gap: 8px;
        }}
        .platform-tab {{
            padding: 8px 16px;
            border: 2px solid #c5d8f5;
            border-radius: 999px;
            background: #fff;
            color: #0066cc;
            font-weight: bold;
            font-size: 0.95em;
            cursor: pointer;
            transition: border-color .15s, background .15s, color .15s;
        }}
        .platform-tab:hover {{
            border-color: #0066cc;
            background: #f3f8ff;
        }}
        .platform-tab.active {{
            border-color: #0066cc;
            background: #0066cc;
            color: #fff;
        }}
        .header.channel-header .platform-tab.active {{
            border-color: #7c4dff;
            background: #7c4dff;
        }}
        .primary-link {{
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 22px;
            min-height: 44px;
            background: #0066cc;
            color: #fff;
            border-radius: 8px;
            margin: 10px 0;
            border: none;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            text-decoration: none;
            overflow: hidden;
            isolation: isolate;
            z-index: 0;
            box-shadow: 0 4px 12px rgba(0, 102, 204, 0.28);
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }}
        .primary-link .btn-text {{
            position: relative;
            z-index: 2;
        }}
        .primary-link.is-disabled {{
            pointer-events: none;
            cursor: not-allowed;
            box-shadow: none;
            opacity: 0.55;
            background: #8aa8cc;
        }}
        .primary-link.is-disabled.chroma {{
            background: #8aa8cc;
        }}
        .primary-link.is-disabled.chroma::before,
        .primary-link.is-disabled.chroma::after {{
            display: none;
        }}
        /* 无缝炫彩：色带重复两份，translateX 平移 50% 避免顿挫 */
        .primary-link.chroma:not(.is-disabled) {{
            background: transparent;
        }}
        .primary-link.chroma:not(.is-disabled)::before {{
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 200%;
            z-index: 0;
            background: linear-gradient(
                90deg,
                #ff4d4f, #fa8c16, #fadb14, #52c41a, #13c2c2, #1677ff, #722ed1, #eb2f96,
                #ff4d4f, #fa8c16, #fadb14, #52c41a, #13c2c2, #1677ff, #722ed1, #eb2f96,
                #ff4d4f
            );
            animation: chroma-slide 3s linear infinite;
            pointer-events: none;
            will-change: transform;
        }}
        .primary-link.chroma:not(.is-disabled)::after {{
            content: "";
            position: absolute;
            top: 0;
            left: -40%;
            width: 40%;
            height: 100%;
            z-index: 1;
            background: linear-gradient(
                100deg,
                transparent 0%,
                rgba(255, 255, 255, 0.15) 40%,
                rgba(255, 255, 255, 0.45) 50%,
                rgba(255, 255, 255, 0.15) 60%,
                transparent 100%
            );
            animation: chroma-shine 2.5s linear infinite;
            pointer-events: none;
            will-change: transform;
        }}
        .primary-link.chroma:not(.is-disabled):hover {{
            filter: brightness(1.05);
            box-shadow: 0 6px 16px rgba(114, 46, 209, 0.35);
            text-decoration: none;
            color: #fff;
        }}
        .primary-link.chroma:not(.is-disabled):active {{
            filter: brightness(0.98);
        }}
        @keyframes chroma-slide {{
            from {{ transform: translateX(0); }}
            to {{ transform: translateX(-50%); }}
        }}
        @keyframes chroma-shine {{
            from {{ transform: translateX(0); }}
            to {{ transform: translateX(350%); }}
        }}
        @media (prefers-reduced-motion: reduce) {{
            .primary-link.chroma:not(.is-disabled)::before,
            .primary-link.chroma:not(.is-disabled)::after {{
                animation: none;
            }}
            .primary-link.chroma:not(.is-disabled)::before {{
                width: 100%;
                background: #0066cc;
                transform: none;
            }}
            .primary-link.chroma:not(.is-disabled)::after {{
                display: none;
            }}
            .primary-link.chroma:not(.is-disabled) {{
                box-shadow: none;
            }}
            .channel-header .primary-link.chroma:not(.is-disabled)::before {{
                background: #7c4dff;
            }}
        }}
        .cancel-btn {{
            display: inline-block;
            padding: 8px 16px;
            background: #ff6666;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-left: 10px;
        }}
        .cancel-btn:hover {{ background: #cc5555; }}
        #countdown {{ color: #ff6600; font-weight: bold; }}
        .disabled {{ color: #999; }}
        .channel {{ background: linear-gradient(135deg, #e8f0fe, #f0e6ff); border-left: 4px solid #7c4dff; }}
        .channel a {{ color: #7c4dff; }}
        .channel a:hover {{ color: #5e35b1; }}
        .channel-item {{ display: none; }}
        .channel-item.is-active {{ display: list-item; }}
        .channel-item.is-recommend {{
            background: #f3e8ff;
            border-left: 4px solid #7c4dff;
        }}
        .tip {{ color: #666; font-size: 0.95em; }}
        .hint {{ color: #555; margin: 8px 0 0; }}
        /* 下方群列表：按平台分块，默认隐藏，选中后只显示对应平台 */
        .group-section {{
            display: none;
            margin: 18px 0 24px;
            padding: 14px 16px 8px;
            border: 1px solid #e3eaf5;
            border-radius: 10px;
            background: #fafcff;
        }}
        .group-section.is-active {{
            display: block;
            border-color: #0066cc;
            box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.12);
            background: #f3f8ff;
        }}
        .group-section-title {{
            margin: 0 0 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e3eaf5;
            font-size: 1.1em;
        }}
        .group-count {{
            color: #888;
            font-weight: normal;
            font-size: 0.9em;
            margin-left: 6px;
        }}
        .group-list {{ margin: 0; }}
        .group-item.is-recommend {{
            background: #fff4e8;
            border-left: 4px solid #ff6600;
        }}
        .group-link {{
            display: block;
            color: inherit;
            text-decoration: none;
            font-weight: normal;
        }}
        .group-link:hover {{ text-decoration: none; }}
        .group-link:hover .group-title {{ text-decoration: underline; color: #004499; }}
        .group-row {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .group-avatar {{
            width: 40px;
            height: 40px;
            border-radius: 8px;
            object-fit: cover;
            flex-shrink: 0;
            background: #e8eef8;
        }}
        .group-body {{
            min-width: 0;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }}
        .group-title {{
            font-weight: bold;
            color: #0066cc;
            word-break: break-all;
        }}
        .group-item.is-recommend .group-title {{ color: #ff6600; }}
        .group-meta {{
            color: #666;
            font-size: 0.9em;
        }}
        .group-meta .full {{ color: #cc4444; }}
        .group-meta .ok {{ color: #2a7a2a; }}
        .disabled-row .group-title {{ color: #999; font-weight: normal; }}
        .header-rec-row {{
            display: none;
            align-items: center;
            gap: 12px;
            margin: 8px 0 4px;
        }}
        .header-rec-row.is-visible {{ display: flex; }}
        .header-avatar {{
            width: 48px;
            height: 48px;
            border-radius: 10px;
            object-fit: cover;
            background: #e8eef8;
            flex-shrink: 0;
        }}
        .header-members {{
            margin: 0;
            color: #555;
            font-size: 0.95em;
        }}
        .lists-heading {{ margin: 24px 0 8px; font-size: 1.15em; }}
        .lists-placeholder {{ color: #888; margin: 12px 0 24px; }}
        .lists-placeholder.is-hidden {{ display: none; }}
        .channel-placeholder {{ color: #888; margin: 8px 0; }}
        .channel-placeholder.is-hidden {{ display: none; }}
        .channel-block.is-empty .channel-list {{ display: none; }}
    </style>
    <script>
        const RECOMMENDS = {recommend_json};
        const CHANNELS = {channels_json};
        const PLATFORM_LABELS = {{ windows: "Windows", android: "Android", mac: "Mac" }};
        // 对外 groupinfo API（头像 + 人数）；失败则不展示
        const GROUPINFO_API = "https://join.maameow.com/api/groupinfo";
        const groupInfoCache = Object.create(null); // gid -> info | null(failed)

        // 必须用户主动选择平台后，才启动自动跳转
        let redirectEnabled = false;
        let countdown = 8;
        let countdownTimer = null;
        let currentJoinUrl = "";
        let currentPlatform = "";
        let userCancelled = false;

        function stopCountdown() {{
            redirectEnabled = false;
            if (countdownTimer) {{
                clearTimeout(countdownTimer);
                countdownTimer = null;
            }}
        }}

        function cancelRedirect() {{
            userCancelled = true;
            stopCountdown();
            const text = document.getElementById("redirectText");
            if (text) text.innerHTML = "自动跳转已取消，可点击上方按钮或下方群链接加入";
        }}

        function handleLinkClick(event) {{
            // 点了列表里的群：取消自动跳转，但保留已选平台与主按钮
            if (currentPlatform) cancelRedirect();
        }}

        function handlePrimaryLinkClick(event) {{
            const primary = document.getElementById("primaryLink");
            if (primary.classList.contains("is-disabled") || !currentJoinUrl) {{
                event.preventDefault();
                return;
            }}
            cancelRedirect();
        }}

        function startRedirect(url) {{
            if (userCancelled) {{
                // 用户已取消过：只更新链接，不再自动跳
                currentJoinUrl = url;
                const text = document.getElementById("redirectText");
                if (text) text.innerHTML = "自动跳转已取消，可点击上方按钮或下方群链接加入";
                return;
            }}
            currentJoinUrl = url;
            redirectEnabled = true;
            countdown = 8;
            if (countdownTimer) clearTimeout(countdownTimer);

            document.getElementById("redirectText").innerHTML =
                '已选择平台，页面将在 <span id="countdown">' + countdown + '</span> 秒后自动跳转……' +
                '<button type="button" id="cancelBtn" class="cancel-btn" onclick="cancelRedirect()">取消自动跳转</button>';
            countdownTimer = setTimeout(updateCountdown, 1000);
        }}

        function updateCountdown() {{
            if (redirectEnabled && countdown > 0) {{
                countdown--;
                const el = document.getElementById("countdown");
                if (el) el.textContent = countdown;
                countdownTimer = setTimeout(updateCountdown, 1000);
            }} else if (redirectEnabled && countdown === 0) {{
                window.location.href = currentJoinUrl;
            }}
        }}

        function formatMembers(info) {{
            if (!info || !info.known) return "";
            const cur = info.member_count;
            const max = info.max_member_count;
            if (!max || max <= 0) return "";
            const free = typeof info.free_slots === "number" ? info.free_slots : Math.max(0, max - cur);
            const cls = free <= 0 ? "full" : "ok";
            const freeText = free <= 0 ? "已满" : ("余 " + free);
            return '<span class="' + cls + '">' + cur + " / " + max + " · " + freeText + "</span>";
        }}

        function applyInfoToItem(li, info) {{
            const avatar = li.querySelector(".group-avatar");
            const meta = li.querySelector(".group-meta");
            if (!info || !info.known) {{
                if (avatar) {{
                    avatar.hidden = true;
                    avatar.removeAttribute("src");
                }}
                if (meta) {{
                    meta.hidden = true;
                    meta.innerHTML = "";
                }}
                return;
            }}
            if (avatar && info.avatar_url) {{
                avatar.src = info.avatar_url;
                avatar.alt = (info.group_name || "") + " 头像";
                avatar.hidden = false;
            }} else if (avatar) {{
                avatar.hidden = true;
            }}
            const html = formatMembers(info);
            if (meta) {{
                if (html) {{
                    meta.innerHTML = html;
                    meta.hidden = false;
                }} else {{
                    meta.hidden = true;
                    meta.innerHTML = "";
                }}
            }}
        }}

        function clearHeaderRecExtra() {{
            const row = document.getElementById("headerRecRow");
            const img = document.getElementById("headerAvatar");
            const members = document.getElementById("headerMembers");
            if (row) row.classList.remove("is-visible");
            if (img) {{
                img.hidden = true;
                img.removeAttribute("src");
            }}
            if (members) {{
                members.hidden = true;
                members.innerHTML = "";
            }}
        }}

        function applyHeaderRecExtra(info) {{
            const row = document.getElementById("headerRecRow");
            const img = document.getElementById("headerAvatar");
            const members = document.getElementById("headerMembers");
            if (!row || !info || !info.known) {{
                clearHeaderRecExtra();
                return;
            }}
            let show = false;
            if (img && info.avatar_url) {{
                img.src = info.avatar_url;
                img.alt = (info.group_name || "推荐群") + " 头像";
                img.hidden = false;
                show = true;
            }} else if (img) {{
                img.hidden = true;
            }}
            const html = formatMembers(info);
            if (members && html) {{
                members.innerHTML = html;
                members.hidden = false;
                show = true;
            }} else if (members) {{
                members.hidden = true;
                members.innerHTML = "";
            }}
            row.classList.toggle("is-visible", show);
        }}

        function chunk(arr, size) {{
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        }}

        function applyPlatformInfoForIds(platform, ids, recGid) {{
            // 只刷新本批相关 DOM，有结果就先展示
            ids.forEach((id) => {{
                if (!(id in groupInfoCache)) return;
                document.querySelectorAll(
                    '.group-item[data-platform="' + platform + '"][data-gid="' + id + '"]'
                ).forEach((li) => {{
                    applyInfoToItem(li, groupInfoCache[id]);
                }});
            }});
            if (recGid && (recGid in groupInfoCache)) {{
                applyHeaderRecExtra(groupInfoCache[recGid]);
            }}
        }}

        async function fetchGroupInfoBatch(ids, onPartDone) {{
            const missing = ids.filter((id) => !(id in groupInfoCache));
            // 已有缓存的也回调，方便立刻上屏
            const already = ids.filter((id) => id in groupInfoCache);
            if (already.length && typeof onPartDone === "function") {{
                onPartDone(already);
            }}
            if (!missing.length) return;

            // 小批量串行；每批返回立刻 onPartDone，不用等全部
            for (const part of chunk(missing, 5)) {{
                try {{
                    const url = GROUPINFO_API + "?ids=" + encodeURIComponent(part.join(","));
                    const resp = await fetch(url, {{
                        method: "GET",
                        mode: "cors",
                        credentials: "omit",
                        cache: "default",
                    }});
                    if (!resp.ok) {{
                        part.forEach((id) => {{ groupInfoCache[id] = null; }});
                        if (typeof onPartDone === "function") onPartDone(part);
                        continue;
                    }}
                    const body = await resp.json();
                    if (!body || body.code !== 0 || !body.data) {{
                        part.forEach((id) => {{ groupInfoCache[id] = null; }});
                        if (typeof onPartDone === "function") onPartDone(part);
                        continue;
                    }}
                    const list = Array.isArray(body.data.groups)
                        ? body.data.groups
                        : (body.data.group_id ? [body.data] : []);
                    const byId = Object.create(null);
                    list.forEach((g) => {{
                        if (g && g.group_id) byId[String(g.group_id)] = g;
                    }});
                    part.forEach((id) => {{
                        const g = byId[id];
                        groupInfoCache[id] = (g && g.known) ? g : null;
                    }});
                }} catch (e) {{
                    part.forEach((id) => {{ groupInfoCache[id] = null; }});
                }}
                if (typeof onPartDone === "function") onPartDone(part);
            }}
        }}

        async function loadPlatformGroupInfo(platform) {{
            const items = document.querySelectorAll(
                '.group-item[data-platform="' + platform + '"][data-gid]'
            );
            const ids = [];
            items.forEach((li) => {{
                const gid = li.getAttribute("data-gid");
                if (gid) ids.push(gid);
            }});
            // 推荐群也查一下（可能与列表同一 gid）
            const rec = RECOMMENDS[platform];
            let recGid = "";
            if (rec && rec.kind !== "channel" && rec.gid) {{
                recGid = String(rec.gid);
                ids.push(recGid);
            }} else {{
                clearHeaderRecExtra();
            }}
            // 推荐群优先拉取，顶部头像/人数更早出现
            let unique = Array.from(new Set(ids));
            if (recGid) {{
                unique = [recGid].concat(unique.filter((id) => id !== recGid));
            }}
            if (!unique.length) {{
                clearHeaderRecExtra();
                return;
            }}
            // 已缓存的立刻上屏
            const cachedNow = unique.filter((id) => id in groupInfoCache);
            if (cachedNow.length) {{
                applyPlatformInfoForIds(platform, cachedNow, recGid);
            }}
            // 逐批回调：哪批好了就先画哪批
            await fetchGroupInfoBatch(unique, (partIds) => {{
                // 平台已切换则丢弃过期回调
                if (currentPlatform !== platform) return;
                applyPlatformInfoForIds(platform, partIds, recGid);
            }});
        }}

        function resetGroupRecommendMarks() {{
            document.querySelectorAll(".group-item").forEach((li) => {{
                li.classList.remove("is-recommend");
                const title = li.querySelector(".group-title");
                if (!title) return;
                const label = li.getAttribute("data-label") || "";
                // 去掉「 - 当前推荐」后缀
                title.textContent = label;
                title.classList.remove("current");
            }});
        }}

        function resetChannelRecommendMarks() {{
            document.querySelectorAll(".channel-item").forEach((li) => {{
                li.classList.remove("is-recommend");
                if (li.querySelector(".disabled")) return;
                const href = li.getAttribute("data-href");
                const label = li.getAttribute("data-label") || "";
                if (!href) return;
                li.innerHTML = '<a href="' + href + '" onclick="handleLinkClick(event)">' +
                    label + "</a>";
            }});
        }}

        function applyGroupRecommendMark(li) {{
            li.classList.add("is-recommend");
            const title = li.querySelector(".group-title");
            const label = li.getAttribute("data-label") || "";
            if (title) {{
                title.textContent = label + " - 当前推荐";
                title.classList.add("current");
            }}
        }}

        function applyChannelRecommendMark(li) {{
            li.classList.add("is-recommend");
            const label = li.getAttribute("data-label") || "";
            li.innerHTML = '<strong><span class="current">' + label +
                " - 当前推荐</span></strong>";
        }}

        function markPlatformRecommend(platform) {{
            resetGroupRecommendMarks();
            resetChannelRecommendMarks();

            const listsPlaceholder = document.getElementById("listsPlaceholder");
            if (listsPlaceholder) listsPlaceholder.classList.add("is-hidden");

            document.querySelectorAll(".group-section").forEach((sec) => {{
                sec.classList.toggle("is-active", sec.getAttribute("data-platform") === platform);
            }});

            // 频道：只展示当前平台
            const channelPlaceholder = document.getElementById("channelPlaceholder");
            const channelBlock = document.getElementById("channelBlock");
            let hasChannel = false;
            document.querySelectorAll(".channel-item").forEach((li) => {{
                const match = li.getAttribute("data-platform") === platform;
                li.classList.toggle("is-active", match);
                if (match) hasChannel = true;
            }});
            if (channelPlaceholder) {{
                channelPlaceholder.classList.toggle("is-hidden", hasChannel);
                if (!hasChannel) {{
                    channelPlaceholder.textContent = "该平台暂无 QQ 频道";
                }}
            }}
            if (channelBlock) {{
                channelBlock.classList.toggle("is-empty", !hasChannel);
            }}

            document.querySelectorAll(
                '.group-item[data-platform="' + platform + '"][data-recommend="1"]'
            ).forEach(applyGroupRecommendMark);
            document.querySelectorAll(
                '.channel-item[data-platform="' + platform + '"][data-recommend="1"]'
            ).forEach(applyChannelRecommendMark);
        }}

        function selectPlatform(platform) {{
            const rec = RECOMMENDS[platform];
            if (!rec) return;

            // 主动点选平台视为新意图：重新开启自动跳转
            userCancelled = false;
            currentPlatform = platform;

            document.querySelectorAll(".platform-tab").forEach((btn) => {{
                btn.classList.toggle("active", btn.getAttribute("data-platform") === platform);
            }});

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

            if (isChannel) {{
                title.textContent = "欢迎加入【" + rec.name + "】（" + label + "）";
                gidEl.style.display = "none";
                if (btnText) btnText.textContent = "立即加入 QQ 频道";
            }} else {{
                title.textContent = "欢迎加入【" + rec.name + "】（" + label + "）";
                if (rec.gid) {{
                    gidEl.style.display = "";
                    gidEl.innerHTML = '群号: <strong>' + rec.gid + "</strong>";
                }} else {{
                    gidEl.style.display = "none";
                }}
                if (btnText) btnText.textContent = "立即加入当前推荐群组";
            }}

            primary.href = rec.url;
            primary.classList.remove("is-disabled");
            primary.setAttribute("aria-disabled", "false");
            startRedirect(rec.url);
        }}
    </script>
</head>
<body>
    <div class="container">
        <div id="join-header" class="header{header_extra}">
            <h2 id="join-title">欢迎加入 MAA 交流群</h2>
            <div id="headerRecRow" class="header-rec-row">
                <img id="headerAvatar" class="header-avatar" alt="" width="48" height="48" hidden>
                <p id="headerMembers" class="header-members" hidden></p>
            </div>
            <p id="join-gid" style="display:none"></p>

            <div class="platform-row">
                <span class="platform-label">请先选择平台：</span>
                <div class="platform-tabs" role="tablist" aria-label="客户端平台">
                    <button type="button" class="platform-tab" data-platform="windows"
                        onclick="selectPlatform('windows')">Windows</button>
                    <button type="button" class="platform-tab" data-platform="android"
                        onclick="selectPlatform('android')">Android</button>
                    <button type="button" class="platform-tab" data-platform="mac"
                        onclick="selectPlatform('mac')">Mac</button>
                </div>
            </div>
            <p class="hint">选择平台后才会开始自动跳转，并显示该平台群列表。</p>

            <p>
                <a id="primaryLink" href="#" class="primary-link chroma is-disabled"
                   aria-disabled="true" onclick="handlePrimaryLinkClick(event)">
                    <span class="btn-text">请先选择平台</span>
                </a>
            </p>
            <p id="redirectText">尚未选择平台，不会自动跳转</p>
        </div>

        <div id="channelBlock" class="channel-block"{channel_block_display}>
            <h3>QQ 频道</h3>
            <p id="channelPlaceholder" class="channel-placeholder">请先选择平台，以查看对应频道。</p>
            <ul class="channel-list">
{channel_items_html}            </ul>
        </div>

        <h3 class="lists-heading">群组列表</h3>
        <p id="listsPlaceholder" class="lists-placeholder">请先在上方选择平台，以查看对应群列表。</p>
{groups_sections_html}
        <p class="tip">如果当前群组已满或链接失效，请选择其他群组加入（点击任意链接将取消自动跳转）。</p>
    </div>
</body>
</html>
"""

    out = base / "index.html"
    out.write_text(index_html, encoding="utf-8")

    # 清理旧的分平台页面
    for stale in ("index_windows.html", "index_android.html", "index_mac.html"):
        p = base / stale
        if p.exists():
            p.unlink()

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


if __name__ == "__main__":
    main()
