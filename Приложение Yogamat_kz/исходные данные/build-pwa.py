"""Build a versioned, complete app-shell cache; run after changing dist assets."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
dist = root / 'dist'
assets = sorted(p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file() and p.name not in {'sw.js', 'app-update.json', '.DS_Store', '_headers'})
digest = hashlib.sha256()
for asset in assets:
    digest.update(asset.encode())
    digest.update((dist / asset).read_bytes())
version = digest.hexdigest()[:16]
(dist / 'app-update.json').write_text(json.dumps({'schema':1,'app':'yoga-practice-pwa','version':version,'description':'Обновление файлов приложения без изменения пользовательского хранилища'}, ensure_ascii=False, indent=2) + '\n')
hashes = {a: hashlib.sha256((dist / a).read_bytes()).hexdigest()[:16] for a in assets}
assets.append('app-update.json')
assets.sort()
template = (root / 'sw-template.js').read_text()
(dist / 'sw.js').write_text(template.replace('__VERSION__', version).replace('__ASSETS__', json.dumps(assets, ensure_ascii=False, indent=2)).replace('__HASHES__', json.dumps(hashes, ensure_ascii=False)))
print(f'PWA {version}: {len(assets)} offline assets')
