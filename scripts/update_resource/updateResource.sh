set -e
mkdir -p ~/MaaAssistantArknights
cd ~/MaaAssistantArknights
git init
git fetch --force --no-tags --prune --update-head-ok  \
  'https://github.com/MaaAssistantArknights/MaaAssistantArknights' \
  '+HEAD:refs/remotes/origin/HEAD'
git checkout --force refs/remotes/origin/HEAD

echo ==================== update resource ====================

python3 ~/MaaRelease/scripts/update_resource/list.py \
  ~/MaaAssistantArknights/resource \
  ~/MaaAssistantArknights/resource/dynamic_list.txt
