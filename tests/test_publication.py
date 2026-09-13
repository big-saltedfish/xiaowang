import unittest,tempfile,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'research-skill/watchtower-research/scripts'))
import publication
from method_gate import digest,process
class PublicationTests(unittest.TestCase):
 def make_bundle(self,root):
  sources=[{'id':'src1','url':'https://example.com/notice','published_at':'2026-09-11','kind':'notice','subject':'company-a','text':'Original evidence','tool':'search_notice'}]
  policy={'deduplicate':False,'require_dates':False}
  report={'schema_version':1,'title':'Research','summary':'Evidence checked','date':'2026-09-11','sources':[{'title':'Notice',**sources[0]}],'open_questions':[],'method_changes':[],'policy_hash_used':digest(policy),'claims':[{'claim_id':'claim1','statement':'An event occurred','evidence_source_ids':['src1'],'review_due_at':'2026-09-11T15:40:00+08:00','invalidating_evidence':'A corrected announcement'}]}
  for name,value in [('report.json',report),('sources.json',sources),('policy.json',policy),('validation.json',{'passed':True}),('processed_sources.json',process(policy,sources,report['date']))]:(root/name).write_text(json.dumps(value))
  (root/'report.md').write_text('# Research')
  return report
 def test_complete_package_verifies(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);self.make_bundle(root);m=publication.make(root,'reports/2026/09/11/run1');self.assertTrue(publication.verify(m,root,'2026-09-11')['verified'])
 def test_unknown_claim_reference_fails(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);r=self.make_bundle(root);r['claims'][0]['evidence_source_ids']=['missing'];(root/'report.json').write_text(json.dumps(r))
   with self.assertRaises(ValueError):publication.make(root,'reports/run')
 def test_manifest_date_cannot_relabel_old_report(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);self.make_bundle(root);m=publication.make(root,'reports/run');m['date']='2026-09-12'
   with self.assertRaises(ValueError):publication.verify(m,root,'2026-09-12')
 def test_report_policy_cannot_be_self_asserted(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);r=self.make_bundle(root);r['policy_hash_used']='0'*64;(root/'report.json').write_text(json.dumps(r))
   with self.assertRaises(ValueError):publication.make(root,'reports/run')
 def test_false_processed_output_fails_even_with_passed_validation(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);self.make_bundle(root);(root/'processed_sources.json').write_text('{}')
   with self.assertRaises(ValueError):publication.make(root,'reports/run')
if __name__=='__main__':unittest.main()
