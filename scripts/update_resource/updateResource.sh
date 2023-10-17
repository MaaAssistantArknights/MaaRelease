set -e
mkdir -p ~/MaaAssistantArknights
cd ~/MaaAssistantArknights
git init
git fetch --force --no-tags --prune --update-head-ok --progress  \
  'https://github.com/MaaAssistantArknights/MaaAssistantArknights' \
  '+HEAD:refs/remotes/origin/HEAD'
git checkout --force --progress refs/remotes/origin/HEAD

python3 ~/MaaRelease/scripts/update_resource/list.py \
  ~/MaaAssistantArknights/resource \
  ~/MaaAssistantArknights/resource/dynamic_list.txt
