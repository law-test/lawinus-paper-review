"""Run: python -m unittest discover -s tests -p test_revision_proposals.py"""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('proposal_sync', Path(__file__).parents[1] / 'scripts/sync-revision-proposals.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SafeProposalText(unittest.TestCase):
    def setUp(self):
        self.baseline = {'paragraphs': [{'id': 'P0001', 'text': '원문[^1]'}, {'id': 'P0002', 'text': '다음 문단'}],
                         'footnotes': [{'number': 1, 'text': '저자, 책.'}, {'number': 2, 'text': '앞의 책(주 1), 10면.'}]}
        self.catalog = {'pdfSha256': 'human-pdf', 'paragraphs': copy.deepcopy(self.baseline['paragraphs'])}
        self.originals = {'pdfSha256': 'human-pdf', 'paragraphSha256': {p['id']: sync.digest(p['text']) for p in self.baseline['paragraphs']},
                          'footnotes': [dict(n, textSha256=sync.digest(n['text'])) for n in self.baseline['footnotes']]}
        self.patches = {'edits': [], 'insertions': [], 'notes': [], 'new_notes': [{'id': 'N93_NEW', 'text': '새 자료.'}]}
        self.note_map = {'1': 2, '2': 3, 'N93_NEW': 1}

    def item(self, identity='P0001', before='원문〔각주 1〕', after=''):
        return dict(id=identity, before=before, after=after, reason='이유', priority='반드시 수정', page=20, page_end=20)

    def compile(self, item):
        return sync.compile_proposals([item], self.patches, self.baseline, self.catalog, self.originals, self.note_map)[0]

    def test_deletion_is_empty_payload_without_changing_display(self):
        self.patches['edits'] = [{'id': 'P0001', 'before': '원문[^1]', 'after': ''}]
        result = self.compile(self.item(after='(삭제)'))
        self.assertEqual(result['after'], '(삭제)')
        self.assertEqual(result['applyText'], '')

    def test_pure_insertion_retains_full_original_anchor_and_note_identity(self):
        self.patches['insertions'] = [{'after_id': 'P0001', 'text': '추가 문단.'}]
        result = self.compile(self.item(after='원문〔각주 2〕\n\n추가 문단.'))
        self.assertEqual(result['applyText'], '원문[^1]\n\n추가 문단.')

    def test_layout_instructions_never_become_semantic_text(self):
        self.patches['edits'] = [{'id': 'P0001', 'before': '원문[^1]', 'after': '바꾼 문장[^1]'}]
        result = self.compile(self.item(after='바꾼 문장〔각주 2〕\n\n각주 표시와 각주 설명의 첫머리를 같은 면에 배치한다.'))
        self.assertEqual(result['applyText'], '바꾼 문장[^1]')

    def test_footnote_cross_reference_uses_original_number_not_display_number(self):
        self.patches['notes'] = [{'number': 2, 'before': '앞의 책(주 1), 10면.', 'after': '앞의 책(주 1), 11면.'}]
        result = self.compile(self.item('FN2', '각주 2: 앞의 책(주 1), 10면.', '각주 3: 앞의 책(주 2), 11면.'))
        self.assertEqual(result['applyText'], '앞의 책(주 1), 11면.')

    def test_new_note_is_not_mapped_to_an_existing_human_note(self):
        self.patches['insertions'] = [{'after_id': 'P0001', 'text': '추가[^N93_NEW]'}]
        result = self.compile(self.item(after='원문〔각주 2〕\n\n추가〔각주 1〕\n\n〔각주 1〕 새 자료.'))
        self.assertNotIn('applyText', result)
        self.assertIn('새 각주', result['applyUnsupportedReason'])

    def test_original_footnote_referencing_new_note_is_also_blocked(self):
        self.patches['notes'] = [{'number': 2, 'before': '앞의 책(주 1), 10면.', 'after': '앞의 보고서(주 N93_NEW), 11면.'}]
        result = self.compile(self.item('FN2', '각주 2: 앞의 책(주 1), 10면.', '각주 3: 앞의 보고서(주 1), 11면.'))
        self.assertNotIn('applyText', result)

    def test_layout_only_proposal_has_explanation_but_no_payload(self):
        result = self.compile(self.item(after='원문〔각주 2〕\n\n새 면에서 시작한다.'))
        self.assertNotIn('applyText', result)
        self.assertIn('문단 배치', result['applyUnsupportedReason'])

    def test_wrong_target_before_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Guide Before differs'):
            self.compile(self.item(before='다른 문단'))

    def test_semantic_patch_and_display_disagreement_is_rejected(self):
        self.patches['edits'] = [{'id': 'P0001', 'before': '원문[^1]', 'after': '실제 수정문'}]
        with self.assertRaisesRegex(ValueError, 'Guide After differs'):
            self.compile(self.item(after='다른 수정문'))

    def test_unknown_numeric_note_is_rejected_instead_of_invented(self):
        self.patches['edits'] = [{'id': 'P0001', 'before': '원문[^1]', 'after': '잘못된 참조[^99]'}]
        self.note_map['99'] = 100
        with self.assertRaisesRegex(ValueError, 'Unknown footnote key'):
            self.compile(self.item(after='잘못된 참조〔각주 100〕'))

    def test_tampered_human_baseline_is_rejected(self):
        self.catalog['paragraphs'][0]['text'] = '바뀐 원본'
        with self.assertRaisesRegex(ValueError, 'Human paragraph changed'):
            self.compile(self.item())


if __name__ == '__main__':
    unittest.main()
