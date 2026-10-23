"""Publish a display guide and independent human-ID common-edit payloads.

Display After contains applied-version numbering and layout instructions.
Only semantic patches against the immutable human original supply applyText.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def unique_map(rows, key):
    result = {}
    for row in rows:
        identity = str(row[key])
        if identity in result:
            raise ValueError(f'Duplicate {key}: {identity}')
        result[identity] = row
    return result


def normalize_before(text):
    return re.sub(r'〔각주 (\d+)〕', r'[^\1]', text).replace('\t', ' ')


def display_text(text, note_map):
    # Number conversion is solely for comparing the published display guide.
    text = re.sub(r'\(주 (\d+),', r'(주 \1),', text)
    text = re.sub(r'주 (\d+|N(?:8[56789]|9[0123])_[A-Z_0-9]+)(?=\))',
                  lambda m: '주 ' + str(note_map[m[1]]), text)
    return re.sub(r'\[\^([^\]]+)\]', lambda m: '〔각주 ' + str(note_map[m[1]]) + '〕', text).replace('\t', ' ')


def compile_proposals(items, patches, baseline, catalog, originals, note_map):
    if not isinstance(items, list) or not items:
        raise ValueError('The guide must be a nonempty item list.')
    unique_map(items, 'id')
    paragraphs = unique_map(baseline['paragraphs'], 'id')
    footnotes = unique_map(baseline['footnotes'], 'number')
    editable = unique_map(catalog['paragraphs'], 'id')
    original_notes = unique_map(originals['footnotes'], 'number')
    edits = unique_map(patches['edits'], 'id')
    notes = unique_map(patches['notes'], 'number')
    new_notes = unique_map(patches['new_notes'], 'id')
    insertions = defaultdict(list)
    for row in patches['insertions']:
        if row['after_id'] not in paragraphs:
            raise ValueError(f"Unknown insertion anchor: {row['after_id']}")
        insertions[row['after_id']].append(row['text'])
    if catalog['pdfSha256'] != originals['pdfSha256']:
        raise ValueError('Human PDF hash differs from the independent fixture.')
    if set(editable) != set(originals['paragraphSha256']):
        raise ValueError('Editable IDs differ from the human fixture.')
    for identity, row in editable.items():
        if (digest(row['text']) != originals['paragraphSha256'][identity]
                or row['text'] != paragraphs[identity]['text']):
            raise ValueError(f'Human paragraph changed: {identity}')
    if set(footnotes) != set(original_notes):
        raise ValueError('Original footnote IDs differ from the human fixture.')
    for number, row in footnotes.items():
        original = original_notes[number]
        if row['text'] != original['text'] or digest(row['text']) != original['textSha256']:
            raise ValueError(f'Human footnote changed: {number}')
    for identity, row in edits.items():
        if identity not in paragraphs or row['before'] != paragraphs[identity]['text']:
            raise ValueError(f'Patch Before differs from human paragraph: {identity}')
    for number, row in notes.items():
        if number not in footnotes or row['before'] != footnotes[number]['text']:
            raise ValueError(f'Patch Before differs from human footnote: {number}')

    def check_payload(text, identity):
        if not isinstance(text, str) or len(text) > 100000:
            raise ValueError(f'Invalid common-edit text length: {identity}')
        keys = re.findall(r'\[\^([^\]]+)\]', text)
        keys += re.findall(r'주 (\d+|N[A-Z_0-9]+)(?=\))', text)
        for key in keys:
            if key not in footnotes and key not in new_notes:
                raise ValueError(f'Unknown footnote key in {identity}: {key}')
        if any(key in new_notes for key in keys):
            return '새 각주가 추가되는 수정입니다. 각주를 함께 편집해 주세요.'
        if re.search(r'〔각주 \d+〕', text):
            raise ValueError(f'Applied-version note label leaked into payload: {identity}')
        return None

    output = []
    for item in items:
        identity = item['id']
        if 'applyText' in item or 'applyUnsupportedReason' in item:
            raise ValueError(f'Input must be a display-only guide: {identity}')
        for field in ('before', 'after', 'reason', 'priority'):
            if not isinstance(item.get(field), str):
                raise ValueError(f'{identity}: missing {field}')
        if not 1 <= item['page'] <= item.get('page_end', item['page']) <= 279:
            raise ValueError(f'{identity}: invalid human PDF page range')
        row = dict(item)
        if re.fullmatch(r'P\d+', identity):
            if identity not in editable:
                raise ValueError(f'Unknown editable human paragraph: {identity}')
            original = editable[identity]['text']
            if normalize_before(item['before']) != original.replace('\t', ' '):
                raise ValueError(f'Guide Before differs from human paragraph: {identity}')
            if identity not in edits and identity not in insertions:
                row['applyUnsupportedReason'] = '문단 배치에 관한 제안입니다. 필요한 문안은 직접 편집해 주세요.'
            else:
                raw = edits[identity]['after'] if identity in edits else original
                # An insertion replaces its anchor plus the new paragraphs.
                raw += ''.join('\n\n' + text for text in insertions[identity])
                rendered = display_text(raw, note_map) or '(삭제)'
                if item['after'] != rendered and not item['after'].startswith(rendered + '\n\n'):
                    raise ValueError(f'Guide After differs from semantic patches: {identity}')
                reason = check_payload(raw, identity)
                if reason:
                    row['applyUnsupportedReason'] = reason
                elif raw == original:
                    row['applyUnsupportedReason'] = '문단 배치에 관한 제안입니다. 필요한 문안은 직접 편집해 주세요.'
                else:
                    row['applyText'] = raw
        elif re.fullmatch(r'FN\d+', identity):
            number = identity[2:]
            if number not in footnotes or number not in notes:
                raise ValueError(f'Unknown human footnote proposal: {identity}')
            before = re.sub(r'^각주\s*\d+:\s*', '', item['before'])
            prefix = re.match(r'^각주\s*(\d+):', item['before'])
            if not prefix or prefix[1] != number or before != footnotes[number]['text']:
                raise ValueError(f'Guide Before differs from human footnote: {identity}')
            raw = notes[number]['after']
            expected = '각주 ' + str(note_map[number]) + ': ' + display_text(raw, note_map)
            if item['after'] != expected:
                raise ValueError(f'Guide After differs from semantic footnote patch: {identity}')
            reason = check_payload(raw, identity)
            if reason:
                row['applyUnsupportedReason'] = reason
            else:
                row['applyText'] = raw
        else:
            row['applyUnsupportedReason'] = '여러 문단의 구성에 관한 제안입니다. 해당 문단에서 각각 편집해 주세요.'
        output.append(row)
    if [item['page'] for item in output] != sorted(item['page'] for item in output):
        raise ValueError('Guide items are not in human PDF page order.')
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--guide", type=Path, required=True)
    parser.add_argument("--patches", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--note-map", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, default=Path("src/paragraph-catalog.json"))
    parser.add_argument("--originals", type=Path, default=Path("tests/fixtures/human-originals.json"))
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, default=Path("src/revision-proposals.json"))
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    raw = args.guide.read_bytes()
    display = json.loads(raw.decode("utf-8-sig"))
    read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
    items = compile_proposals(display, read(args.patches), read(args.baseline), read(args.catalog), read(args.originals), read(args.note_map))
    output = json.dumps({"version": args.version, "items": items}, ensure_ascii=False, indent=2) + "\n"
    args.output.write_text(output, encoding="utf-8")
    evidence = {
        "version": args.version,
        "count": len(items),
        "guideSha256": hashlib.sha256(raw).hexdigest(),
        "publicJsonSha256": hashlib.sha256(output.encode("utf-8")).hexdigest(),
        "semanticPatchesSha256": hashlib.sha256(args.patches.read_bytes()).hexdigest(),
        "allDisplayFieldsPreserved": all(all(row[key] == value for key, value in source.items()) for source, row in zip(display, items)),
        "humanPdfPages": 279,
        "applicable": sum('applyText' in row for row in items),
        "deletions": [row['id'] for row in items if row.get('applyText') == ''],
        "unsupported": dict(Counter(row['applyUnsupportedReason'] for row in items if 'applyUnsupportedReason' in row)),
        "humanOriginalsValidated": True,
        "deploymentVerified": False,
    }
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False))


if __name__ == "__main__":
    main()
