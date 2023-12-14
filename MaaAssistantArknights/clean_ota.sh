#!/bin/bash

clear_files() {
    # stable version
    ls -tr1 | grep -v "-" | head --lines -3 | xargs -L 1 -r rm -rfv
    # beta version
    ls -tr1 | grep "-" | grep -v ".g" | head --lines -3 | xargs -L 1 -r rm -rfv
    # nightly version
    ls -tr1 | grep "-" | grep ".g" | head --lines -3 | xargs -L 1 -r rm -rfv
    
    # 兜底策略
    ls -tr1 | head --lines -10 | xargs -L 1 -r rm -rfv
}

cd ~/OTA/MaaAssistantArknights/MaaRelease/releases/download
clear_files

cd ~/OTA/MaaAssistantArknights/MaaAssistantArknights/releases/download
clear_files
