import sys

# 使用： python gen_index.py 26
group_index = int(sys.argv[1]) - 1

with open("content_summary.txt", "r", encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]

if group_index < 0 or group_index >= len(lines):
    raise ValueError("群编号超出范围")

url, name, gid = lines[group_index].split("|")

index_html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>欢迎加入 {name}</title>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="5; url={url}" />
</head>
<body>
    欢迎加入【{name}】: {gid}
    <br>
    页面将在 5s 后跳转……
</body>
</html>
"""

with open("index.html", "w", encoding="utf-8") as f:
    f.write(index_html)

print(f"index.html 已更新为 {name}")
