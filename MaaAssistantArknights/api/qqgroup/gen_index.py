import sys

# 使用： python gen_index.py 26
group_index = int(sys.argv[1]) - 1 if len(sys.argv) > 1 else 0

with open("content_summary.txt", "r", encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]

if group_index < 0 or group_index >= len(lines):
    raise ValueError("群编号超出范围")

url, name, gid = lines[group_index].split("|")

groups_list_html = ""
valid_groups_count = 0

for i, line in enumerate(lines):
    parts = line.split("|")
    if len(parts) < 3:
        continue  # 跳过格式不正确的行
        
    u, n, g = parts
    if u.startswith('http'):
        valid_groups_count += 1
        if i == group_index:
            groups_list_html += f'<li><strong><span class="current">{n} ({g}) - 当前推荐</span></strong></li>\n'
        else:
            groups_list_html += f'<li><a href="{u}" onclick="handleLinkClick(event)">{n} ({g})</a></li>\n'
    else:
        # 不合规 → 灰色禁用显示
        groups_list_html += f'<li><span class="disabled">{n} ({g})</span></li>\n'

index_html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>欢迎加入 {name}</title>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
        .current {{ color: #ff6600; }}
        ul {{ list-style-type: none; padding: 0; }}
        li {{ margin: 12px 0; padding: 8px; background: #f9f9f9; border-radius: 5px; }}
        a {{ text-decoration: none; color: #0066cc; font-weight: bold; }}
        a:hover {{ text-decoration: underline; color: #004499; }}
        .container {{ max-width: 800px; margin: 0 auto; }}
        .header {{ background: #eef5ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .primary-link {{ display: inline-block; padding: 10px 20px; background: #0066cc; color: white; border-radius: 5px; margin: 10px 0; }}
        .primary-link:hover {{ background: #004499; text-decoration: none; }}
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
    </style>
    <script>
        let redirectEnabled = true;
        let countdown = 8;
        let countdownTimer = null;
        
        function cancelRedirect() {{
            redirectEnabled = false;
            if (countdownTimer) {{
                clearTimeout(countdownTimer);
            }}
            document.getElementById('countdown').textContent = '0';
            document.getElementById('redirectText').innerHTML = '自动跳转已取消';
            document.getElementById('cancelBtn').style.display = 'none';
        }}
        
        function handleLinkClick(event) {{
            cancelRedirect();
            // 允许正常跳转
        }}
        
        function handlePrimaryLinkClick(event) {{
            cancelRedirect();
            // 允许正常跳转
        }}
        
        function updateCountdown() {{
            if (redirectEnabled && countdown > 0) {{
                countdown--;
                document.getElementById('countdown').textContent = countdown;
                countdownTimer = setTimeout(updateCountdown, 1000);
            }} else if (redirectEnabled && countdown === 0) {{
                window.location.href = "{url}";
            }}
        }}
        
        window.onload = function() {{
            updateCountdown();
        }};
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>欢迎加入【{name}】</h2>
            <p>群号: <strong>{gid}</strong></p>
            <p><a href="{url}" class="primary-link" onclick="handlePrimaryLinkClick(event)">立即加入当前推荐群组</a></p>
            <p id="redirectText">
                页面将在 <span id="countdown">8</span> 秒后自动跳转……
                <button id="cancelBtn" class="cancel-btn" onclick="cancelRedirect()">取消自动跳转</button>
            </p>
        </div>
        
        <h3>可用群组列表 (共 {valid_groups_count} 个):</h3>
        <ul>
            {groups_list_html}
        </ul>
        
        <p class="tip">如果当前群组已满或链接失效，请选择其他群组加入（点击任意链接将取消自动跳转）</p>
    </div>
</body>
</html>
"""

with open("index.html", "w", encoding="utf-8") as f:
    f.write(index_html)

print(f"index.html 已更新为 {name}")
