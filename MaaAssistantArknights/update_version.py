import json
import sys
from pathlib import Path
import urllib.request
import urllib.error
import os

if len(sys.argv) != 3:
    print("Usage: python update_version.py <version_type> <version>")
    sys.exit(1)

version_type = sys.argv[1]
version_id = sys.argv[2]

if version_type != "alpha" and version_type != "beta" and version_type != "stable":
    print("Usage: python update_version.py <version_type> <version>")
    print("version_type must be alpha, beta, or stable")
    sys.exit(1)


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

def get_release_info(repo: str, tag: str):
    url = f"https://api.github.com/repos/MaaAssistantArknights/{repo}/releases/tags/{tag}"
    req = urllib.request.Request(url)
    token = os.environ.get("GH_TOKEN", os.environ.get("GITHUB_TOKEN", None))
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    resp = retry_urlopen(req).read()
    releases = json.loads(resp)
    for rel in releases["assets"]:
        del rel["uploader"]

    return releases


if version_type == "alpha":
    main_details = None
else:
    main_details = get_release_info("MaaAssistantArknights", version_id)

ota_details = get_release_info("MaaRelease", version_id)

api_path = Path(__file__).parent / "api" / "version" / "maa_version.json"
with open(api_path, "r") as f:
    channels = json.load(f)

version_json = {
        "version": version_id,
        "details": main_details,
        "ota_details": ota_details,
    }

if version_type == "alpha":
    channels["alpha"] = version_json

if version_type == "beta":
    channels["alpha"] = version_json
    channels["beta"] = version_json

if version_type == "stable":
    channels["alpha"] = version_json
    channels["beta"] = version_json
    channels["stable"] = version_json

with open(api_path, "w") as f:
    json.dump(channels, f)
