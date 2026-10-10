import re
src = open('_gen_members.py', encoding='utf-8').read()

anchor = "m = re.search(r'(const MEMBERS_DEFAULT = \\[)([\\s\\S]*?)(\\n\\];)', ref)"
if anchor not in src:
    # 兜底：直接定位该行
    for line in src.splitlines():
        if 'const MEMBERS_DEFAULT' in line and 're.search' in line:
            anchor = line
            break
print('anchor found:', anchor in src)

new = anchor.replace('(\\n\\];)', '(\\r?\\n\\];)')
src = src.replace(anchor, new)

marker = 'MEMBERS_BLOCK = m.group(1)'
pos = src.find(marker)
assert pos >= 0, 'marker missing'
insert = (
    "MEMBERS_BLOCK = m.group(1)\n"
    "entries = re.findall(r'\\{[^{}]*\\}', m.group(2))\n"
    "parsed = []\n"
    "for e in entries:\n"
    "    sec = int(re.search(r'section: (\\d+)', e).group(1))\n"
    "    parsed.append((sec, e))\n"
    "parsed.sort(key=lambda t: t[0])   # stable sort by section\n"
    "nl = '\\r\\n' if '\\r\\n' in ref else '\\n'\n"
    "MEMBERS_BLOCK = m.group(1) + nl + (',' + nl).join(e for _, e in parsed) + m.group(3)\n"
)
src = src[:pos] + insert + src[pos + len(marker):]
open('_gen_members.py', 'w', encoding='utf-8').write(src)
print('generator patched OK')
