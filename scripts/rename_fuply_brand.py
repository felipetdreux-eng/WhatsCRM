from pathlib import Path
import json

changed = []
replacements = 0

paths = [Path('README.md'), Path('index.html')]
paths += list(Path('src').rglob('*.jsx'))
paths += list(Path('src').rglob('*.js'))

for path in paths:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    count = text.count('ZapFlow')
    if count:
        path.write_text(text.replace('ZapFlow', 'Fuply'), encoding='utf-8')
        changed.append(str(path))
        replacements += count

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
if package.get('name') != 'fuply':
    package['name'] = 'fuply'
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    changed.append(str(package_path))

lock_path = Path('package-lock.json')
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock_changed = False
if lock.get('name') != 'fuply':
    lock['name'] = 'fuply'
    lock_changed = True
root_pkg = lock.get('packages', {}).get('')
if isinstance(root_pkg, dict) and root_pkg.get('name') != 'fuply':
    root_pkg['name'] = 'fuply'
    lock_changed = True
if lock_changed:
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    changed.append(str(lock_path))

if not changed:
    raise SystemExit('No branding changes were needed')

print(f'Replaced {replacements} visible ZapFlow occurrence(s).')
print('Changed files:')
for path in changed:
    print(f' - {path}')
print('Technical zapflow-* storage/event identifiers were intentionally preserved.')
