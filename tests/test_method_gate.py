import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('gate',Path(__file__).resolve().parents[1]/'research-skill/watchtower-research/scripts/method_gate.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
class MethodGateTests(unittest.TestCase):
 def sources(self):return [{'id':'a','url':'https://example.com/notice','published_at':'2026-09-11','kind':'notice','text':'source text'},{'id':'b','url':'https://example.com/notice#copy','published_at':'2026-09-11','kind':'notice','text':'source text'}]
 def test_real_duplicate_reduction_enters_trial(self):
  verdict=gate.evaluate({'deduplicate':False,'require_dates':False},{'deduplicate':True,'require_dates':True},self.sources(),'2026-09-11')
  self.assertEqual(verdict['decision'],'trial');self.assertEqual(verdict['candidate_metrics']['retained_source_ids'],['a','b'])
 def test_self_claimed_pass_does_not_promote(self):
  s=self.sources()[:1];v=gate.evaluate({'deduplicate':True,'require_dates':True},{'deduplicate':True,'require_dates':True},s,'2026-09-11');self.assertEqual(v['decision'],'no_change')
 def test_unknown_rule_is_rejected(self):
  with self.assertRaises(ValueError):gate.evaluate({'deduplicate':False,'require_dates':False},{'predict_returns':True},self.sources(),'2026-09-11')
 def test_missing_evidence_cannot_promote(self):
  with self.assertRaises(ValueError):gate.evaluate({'deduplicate':False,'require_dates':False},{'deduplicate':True,'require_dates':True},[],'2026-09-11')
 def test_undated_sources_preserved_as_unresolved(self):
  s=self.sources()[:1];s[0]['published_at']=None;v=gate.evaluate({'deduplicate':False,'require_dates':False},{'deduplicate':False,'require_dates':True},s,'2026-09-11');self.assertEqual(v['decision'],'trial');self.assertEqual(v['candidate_metrics']['unresolved'],1);self.assertEqual(v['candidate_metrics']['retained_source_ids'],['a'])
 def test_new_evidence_with_distinct_subjects_rejects_previous_trial(self):
  s=self.sources();s[0]['subject']='company-a';s[1]['subject']='company-b'
  v=gate.evaluate({'deduplicate':False,'require_dates':False},{'deduplicate':True,'require_dates':True},s,'2026-09-11')
  self.assertEqual(v['decision'],'reject');self.assertFalse(v['checks']['no_mixed_subject_groups'])
if __name__=='__main__':unittest.main()
