import json
import sys
from pathlib import Path
import urllib.request
import urllib.error
import os


def retry_urlopen(*args, **kwargs):
    import time
    import http.client
    for _ in range(5):
        try:
            resp: http.client.HTTPResponse = urllib.request.urlopen(*args, **kwargs)
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
                print(f"rate limit exceeded, retrying after {reset_time - t0:.1f} seconds")
                time.sleep(reset_time - t0)
                continue
            raise


def get_tag_info(repo: str, tag: str):
    url = f"https://api.github.com/repos/MaaAssistantArknights/{repo}/releases/tags/{tag}"
    req = urllib.request.Request(url)
    token = os.environ.get("GH_TOKEN", os.environ.get("GITHUB_TOKEN", None))
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    resp = retry_urlopen(req).read()
    releases = json.loads(resp)

    del releases["author"]
    assets = releases["assets"]
    mini_assets = []
    for rel in assets:
        temp = {}
        temp["name"] = rel["name"]
        temp["browser_download_url"] = rel["browser_download_url"]
        mini_assets.append(temp)

    releases["assets"] = mini_assets
    return releases


def get_version_json(version_id: str, only_alpha: bool):
    ota_details = get_tag_info("MaaRelease", version_id)
    if only_alpha:
        main_details = None
        body = ota_details["body"]
    else:
        main_details = get_tag_info("MaaAssistantArknights", version_id)
        body = main_details["body"]

    version_json = {
        "version": version_id,
        "body": body,
        "details": main_details,
        "ota_details": ota_details,
    }

    return version_json


def get_release_info():
    url = f"https://api.github.com/repos/MaaAssistantArknights/MaaRelease/releases"
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

        elif len(seg) == 4: # beta
            if not beta:
                beta = tag_name
            if not alpha:
                alpha = tag_name

        else: # alpha
            if not alpha:
                alpha = tag_name

        if stable and beta and alpha:
            break

    return alpha, beta, stable

def main():
    alpha, beta, stable = get_release_info()
    print(f"alpha: {alpha}, beta: {beta}, stable: {stable}")

    alpha_json = get_version_json(alpha, True)
    beta_json = get_version_json(beta, False)
    stable_json = get_version_json(stable, False)
    full_json = {
        "alpha": alpha_json,
        "beta": beta_json,
        "stable": stable_json,
    }

    api_path = Path(__file__).parent / "api" / "version" / "maa_version.json"
    with open(api_path, "w", encoding='utf-8') as f:
        json.dump(full_json, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
