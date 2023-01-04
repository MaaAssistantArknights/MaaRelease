cd ~/OTA/MaaAssistantArknights/MaaRelease/releases/download

# stable version
ls -tr1 | grep -v "-" | head --lines -5 | xargs -L 1 -r rm -rfv
# beta version
ls -tr1 | grep "-" | grep -v ".g" | head --lines -5 | xargs -L 1 -r rm -rfv
# nightly version
ls -tr1 | grep "-" | grep ".g" | head --lines -5 | xargs -L 1 -r rm -rfv

# 兜底策略
ls -tr1 | head --lines -30 | xargs -L 1 -r rm -rfv
