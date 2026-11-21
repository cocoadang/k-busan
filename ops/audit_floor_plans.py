#!/usr/bin/env python3
"""Read-only existing inventory/onscreen image audit. Requires Python Playwright and Chromium.

Run from repo root: python3 ops/audit_floor_plans.py https://apt.dsoom.com --output /tmp/floor-audit.json
Add --require-complete to use all 41 cards having displayed plans as a strict completion gate.
Use --require-gap-notes on revisions with explicit source and reason for empty cards.
"""
import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import Error, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'src/housing/largeApartmentCatalog.json'
GAPS = ROOT / 'src/housing/largeApartmentFloorPlanGaps.json'

def audit(page, base, names, gaps):
    page.goto(f'{base.rstrip("/")}/?view=floor-plans', wait_until='domcontentloaded', timeout=30_000)
    section = page.get_by_role('region', name='대단지 평면도')
    expect(section).to_be_visible(timeout=15_000)
    expect(section.locator('article')).to_have_count(len(names))
    results = []
    for name in names:
        row = {'name': name, 'state': 'error', 'variants': [], 'source': None, 'reason': None}
        results.append(row)
        try:
            card = section.locator('article').filter(has=page.get_by_role('heading', name=name, exact=True))
            expect(card).to_have_count(1)
            link = card.get_by_role('link', name='출처 ·', exact=False)
            if link.count():
                row['source'] = link.first.get_attribute('href')
            details = card.locator('details')
            details.locator('summary').click()
            status = details.get_by_role('status').filter(has_not_text='평면도 불러오는 중')
            legacy_empty = details.get_by_text(re.compile(r'^(확인된 평면도 이미지가|해당 전용면적의 도면이) 아직 등록되지 않았습니다\.$'))
            notice = status.or_(legacy_empty)
            select = details.get_by_role('combobox')
            select.or_(notice).first.wait_for(state='visible', timeout=16_000)
            if not select.count():
                diagnosis = notice.first.inner_text()
                row['state'] = 'empty' if '등록되지 않았습니다' in diagnosis or '저장된 도면이 없습니다' in diagnosis else 'error'
                row['reason'] = diagnosis
                if name in gaps:
                    row['gap_note_matches'] = gaps[name]['reason'] in diagnosis and row['source'] == gaps[name]['source']['url']
            else:
                options = select.locator('option').all_text_contents()
                for i, label in enumerate(options):
                    select.select_option(index=i)
                    image = details.get_by_role('img', name=f'{name} {label} 평면도', exact=True)
                    variant = {'type': label, 'visible': False}
                    row['variants'].append(variant)
                    try:
                        image.scroll_into_view_if_needed(timeout=7_000)
                        expect(image).to_be_visible(timeout=7_000)
                        width, height = image.evaluate('async img => { await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error("image decode timed out")), 7000))]); return [img.naturalWidth, img.naturalHeight]; }', timeout=8_000)
                        if min(width, height) < 20:
                            raise ValueError('invalid image dimensions')
                        variant.update(visible=True, width=width, height=height)
                    except (Error, AssertionError, ValueError) as exc:
                        variant['reason'] = str(exc).splitlines()[0]
                row['state'] = 'displayed' if options and all(x['visible'] for x in row['variants']) else 'image_error'
            details.locator('summary').click()
        except (Error, AssertionError) as exc:
            row['reason'] = str(exc).splitlines()[0]
    return results

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base_url')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_EXECUTABLE'))
    parser.add_argument('--require-complete', action='store_true')
    parser.add_argument('--require-gap-notes', action='store_true')
    args = parser.parse_args()
    names = [a['name'] for a in json.loads(CATALOG.read_text())['apartments']]
    gaps = json.loads(GAPS.read_text())
    assert len(names) == len(set(names)) == 41, 'unexpected catalog coverage'
    assert set(gaps) <= set(names), 'gap source outside catalog'
    with sync_playwright() as p:
        launch = {'executable_path': args.chromium} if args.chromium else {}
        with p.chromium.launch(**launch) as browser:
            results = audit(browser.new_page(viewport={'width': 390, 'height': 844}), args.base_url, names, gaps)
    summary = {state: sum(r['state'] == state for r in results) for state in ['displayed', 'empty', 'error', 'image_error']}
    out = {'observed_utc': datetime.now(timezone.utc).isoformat(), 'base_url': args.base_url, 'summary': summary, 'complexes': results}
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False))
    if summary['error'] or summary['image_error'] or (args.require_complete and summary['empty']) or (
        args.require_gap_notes and any(r['state'] == 'empty' and not r.get('gap_note_matches') for r in results)
    ):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
