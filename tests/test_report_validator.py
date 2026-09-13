import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('report_validator',Path(__file__).resolve().parents[1]/'research-skill/watchtower-research/scripts/validate_report.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class ValidatorTests(unittest.TestCase):
 def valid(self):return {'schema_version':1,'title':'Daily research','date':'2026-09-10','summary':'Actual data reviewed','sources':[{'title':'Disclosure','url':'https://example.com/notice','published_at':'2026-09-09','kind':'notice'}],'open_questions':['Need more evidence'],'method_changes':[]}
 def test_valid(self):self.assertEqual(module.validate(self.valid()),[])
 def test_no_source_is_not_validated(self):
  r=self.valid();r['sources']=[];self.assertTrue(module.validate(r))
 def test_future_date_is_rejected(self):
  r=self.valid();r['sources'][0]['published_at']='2026-09-11';self.assertTrue(module.validate(r))
 def test_active_markup_links_are_rejected(self):
  r=self.valid();r['sources'][0]['url']='javascript:alert(1)';self.assertTrue(module.validate(r))
 def test_claimed_improvement_needs_evidence(self):
  r=self.valid();r['method_changes']=[{'before':'old','after':'new','reason':'better','status':'validated','evidence':''}];self.assertTrue(module.validate(r))
 def test_duplicate_urls_are_rejected(self):
  r=self.valid();r['sources'].append(dict(r['sources'][0]));self.assertTrue(module.validate(r))
 def test_self_asserted_performance_check_cannot_validate_method(self):
  r=self.valid();r['method_changes']=[{'before':'old','after':'new','reason':'new heuristic','status':'validated','evidence':'self assessment','checks':[{'name':'higher_returns','passed':True}]}];self.assertTrue(module.validate(r))
 def test_fixed_structure_check_can_be_recorded(self):
  r=self.valid();r['method_changes']=[{'before':'no dates','after':'date every source','reason':'traceability','status':'validated','evidence':'report source dates','checks':[{'name':'source_dates','passed':True}]}];self.assertEqual(module.validate(r),[])
if __name__=='__main__':unittest.main()
