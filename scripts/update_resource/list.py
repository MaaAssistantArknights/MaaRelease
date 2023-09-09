import sys
import os
from pathlib import Path

if len(sys.argv) < 3:
    print("Usage: python3 list.py <resource> <output>")
    exit(1)

resource = Path(sys.argv[1])
output = Path(sys.argv[2])

def listfiles(path, prefix):
    files = []
    for f in os.listdir(path):
        if not f.endswith('.png') and not f.endswith('.json'):
            continue
        files.append(str(prefix + f))
    return files

files = listfiles(resource / "template"/"infrast", "resource/template/infrast/")
files += listfiles(resource / "template"/"items", "resource/template/items/")
files += listfiles(resource / "Arknights-Tile-Pos", "resource/Arknights-Tile-Pos/")

context = '\n'.join(files)
print(context)

with open(output, 'w') as f:
    f.write(context)
    