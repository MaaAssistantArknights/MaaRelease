import json
from pathlib import Path
import urllib.request
import urllib.error
import os
import re
import time
import http.client


def retry_urlopen(*args, **kwargs):
    for _ in range(5):
        try:
            resp: http.client.HTTPResponse = urllib.request.urlopen(
                *args, **kwargs)
            return resp
        except urllib.error.HTTPError as e:
            if e.status == 403 and e.headers.get("x-ratelimit-remaining") == "0":
                # rate limit
                t0 = time.time()
                reset_time = t0 + 10
                try:
                    reset_time = int(e.headers.get("x-ratelimit-reset", 0))
                except ValueError:
                    pass
                reset_time = max(reset_time, t0 + 10)
                print(
                    f"rate limit exceeded, retrying after {reset_time - t0:.1f} seconds")
                time.sleep(reset_time - t0)
                continue
            raise


MIRRORS = [
    ("github.com", "s3.maa-org.net:25240/maaassistantarknights"),
    ("github.com", "maa.r2.imgg.dev"),
    ("github.com", "agent.imgg.dev"),
    ("github.com", "agent.chingc.cc"),
]

ANNANGELA_MIRRORS = {
    'raw': "github.com",
    'rep': "maa-ota.annangela.cn"
}


def extract_integers(string):
    pattern = r'\b\d+\b'
    integers = re.findall(pattern, string)
    return [int(num) for num in integers[:2]]


def get_annangela_mirror(rel):
    return False

    name = rel['name']
    url = rel["browser_download_url"]

    if "-win-" not in rel['name']:
        return False

    if "MAAComponent-OTA-v" not in rel['name']:
        return False

    pattern = r"(?<=MAAComponent-OTA-v)(\d+(?:\.\d+)*)(?:-[^-_]+)?_v(\d+(?:\.\d+)*)(?=-)"
    matches = re.search(pattern, name)
    if matches:
        before = matches.group(1)
        after = matches.group(2)
        beforeMajor, beforeMinor, *rest = extract_integers(before)
        afterMajor, afterMinor, *rest = extract_integers(after)
        if beforeMajor != afterMajor or afterMinor - beforeMinor > 3:
            return False
    else:
        return False

    return url.replace(ANNANGELA_MIRRORS['raw'], ANNANGELA_MIRRORS['rep'])


def get_tag_info(repo: str, tag: str, tagType: str):
    url = f"https://api.github.com/repos/MaaAssistantArknights/{repo}/releases/tags/{tag}"
    print(url)
    req = urllib.request.Request(url)
    token = os.environ.get("GH_TOKEN", os.environ.get("GITHUB_TOKEN", None))
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    resp = retry_urlopen(req).read()
    releases = json.loads(resp)

    del releases["author"]

    assets = releases["assets"]
    new_assets = []
    for rel in assets:
        if not re.search(r'-(?:win|linux)-|-macos-universal\.dmg|-macos-runtime-universal\.zip', rel['name']):
            continue
        mirrors = []
        url = rel["browser_download_url"]

        for (raw, rep) in MIRRORS:
            m = url.replace(raw, rep)
            mirrors.append(m)

        if tagType != "alpha":
            result = get_annangela_mirror(rel)
            if result != False:
                mirrors.append(result)

        new_rel = {
            "name": rel["name"],
            "size": rel["size"],
            "browser_download_url": rel["browser_download_url"],
            "mirrors": mirrors,
        }
        new_assets.append(new_rel)

    releases["assets"] = new_assets

    return releases


def get_version_json(version_id: str, tagType: str):
    ota_details = get_tag_info("MaaRelease", version_id, tagType)
    try:
        main_details = get_tag_info(
            "MaaAssistantArknights", version_id, tagType)
    except urllib.error.HTTPError as e:
        if e.status == 404:
            main_details = None
        else:
            raise

    if main_details:
        main_details["assets"] += ota_details["assets"]
    else:
        main_details = ota_details

    version_json = {
        "version": version_id,
        "details": main_details,
    }

    return version_json


def get_release_info():
    url = f"https://api.github.com/repos/MaaAssistantArknights/MaaRelease/releases?per_page=100"
    req = urllib.request.Request(url)
    token = os.environ.get("GH_TOKEN", os.environ.get("GITHUB_TOKEN", None))
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    resp = retry_urlopen(req).read()
    releases = json.loads(resp)

    alpha = None
    beta = None
    stable = None
    for rel in releases:
        tag_name = rel["tag_name"]
        seg = tag_name.split(".")

        if len(seg) == 3:   # stable
            if not stable:
                stable = tag_name
            if not beta:
                beta = tag_name
            if not alpha:
                alpha = tag_name

        elif len(seg) == 4:  # beta
            if not beta:
                beta = tag_name
            if not alpha:
                alpha = tag_name

        else:  # alpha
            if not alpha:
                alpha = tag_name

        if stable and beta and alpha:
            break

    return alpha, beta, stable


def main():
    alpha, beta, stable = get_release_info()
    print(f"alpha: {alpha}, beta: {beta}, stable: {stable}")

    alpha_json = get_version_json(alpha, 'alpha')
    beta_json = get_version_json(beta, 'beta')
    stable_json = get_version_json(stable, 'stable')

    summary_json = {
        "alpha": {
            "version": alpha_json["version"],
            "detail": "https://ota.maa.plus/MaaAssistantArknights/api/version/alpha.json"
        },
        "beta": {
            "version": beta_json["version"],
            "detail": "https://ota.maa.plus/MaaAssistantArknights/api/version/beta.json"
        },
        "stable": {
            "version": stable_json["version"],
            "detail": "https://ota.maa.plus/MaaAssistantArknights/api/version/stable.json"
        }
    }

    api_path = Path(__file__).parent / "api" / "version"

    def save_json(json_data, file_name):
        with open(api_path / file_name, "w", encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

    save_json(alpha_json, "alpha.json")
    save_json(beta_json, "beta.json")
    save_json(stable_json, "stable.json")
    save_json(summary_json, "summary.json")


if __name__ == '__main__':
    main()
