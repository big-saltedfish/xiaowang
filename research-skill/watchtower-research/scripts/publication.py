"""Cross-file validation and byte integrity for a research publication."""
import hashlib,json,sys,datetime,re
from pathlib import Path
from method_gate import digest,process
from validate_report import validate
FILES=('report.md','report.json','sources.json','validation.json','policy.json','processed_sources.json')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def inspect(root):
 root=Path(root);report=json.loads((root/'report.json').read_text());errors=validate(report)
 if errors:raise ValueError('Report validation failed: '+'; '.join(errors))
 validation=json.loads((root/'validation.json').read_text())
 if validation.get('passed') is not True:raise ValueError('Report validation has not passed')
 sources=json.loads((root/'sources.json').read_text());policy=json.loads((root/'policy.json').read_text());actual=json.loads((root/'processed_sources.json').read_text())
 if not isinstance(sources,list) or not sources or any(not r.get('id') or not r.get('text') or not r.get('tool') or not r.get('subject') for r in sources):raise ValueError('Original tool evidence and subject are required')
 expected=process(policy,sources,report['date'])
 if actual!=expected:raise ValueError('Recorded processing does not match fixed policy execution')
 if expected['metrics']['mixed_subject_groups']:raise ValueError('Policy merged distinct subjects; rerun with previous verified policy and record fallback')
 if not re.fullmatch('[0-9a-f]{64}',report.get('policy_hash_used','')) or report['policy_hash_used']!=digest(policy):raise ValueError('Applied policy hash mismatch')
 ids={s['id'] for s in sources};claims=report.get('claims');claim_ids=set()
 if not isinstance(claims,list) or not claims:raise ValueError('Reviewable claims are required')
 for claim in claims:
  if not claim.get('claim_id') or claim['claim_id'] in claim_ids or not claim.get('statement'):raise ValueError('Unique claim id and statement required')
  claim_ids.add(claim['claim_id']);refs=claim.get('evidence_source_ids')
  if not isinstance(refs,list) or not refs or not set(refs)<=ids:raise ValueError('Claim references unknown or empty evidence')
  if not claim.get('invalidating_evidence'):raise ValueError('Claim needs a falsification condition')
  datetime.datetime.fromisoformat(claim['review_due_at'].replace('Z','+00:00'))
 return report

def make(root,prefix):
 root=Path(root)
 if prefix.startswith('/') or '..' in prefix.split('/'):raise ValueError('Drive prefix must be relative')
 report=inspect(root)
 return {'schema_version':2,'date':report['date'],'completed':True,'policy_hash_used':report['policy_hash_used'],'files':{name:{'path':prefix.rstrip('/')+'/'+name,'sha256':sha(root/name)} for name in FILES}}

def verify(manifest,root,expected_date=None):
 if manifest.get('completed') is not True or set(manifest.get('files',{}))!=set(FILES):raise ValueError('Incomplete manifest')
 for name in FILES:
  if sha(Path(root)/name)!=manifest['files'][name]['sha256']:raise ValueError('Publication hash mismatch: '+name)
 report=inspect(root)
 if manifest.get('date')!=report['date'] or (expected_date and report['date']!=expected_date):raise ValueError('Publication date mismatch')
 if manifest.get('policy_hash_used')!=report['policy_hash_used']:raise ValueError('Manifest policy mismatch')
 return {'verified':True,'date':report['date'],'files':len(FILES)}
if __name__=='__main__':
 if len(sys.argv)<4:sys.exit('Usage: publication.py make DIRECTORY DRIVE_PREFIX | verify MANIFEST DIRECTORY YYYY-MM-DD')
 if sys.argv[1]=='make':result=make(sys.argv[2],sys.argv[3])
 elif sys.argv[1]=='verify' and len(sys.argv)==5:result=verify(json.loads(Path(sys.argv[2]).read_text()),sys.argv[3],sys.argv[4])
 else:sys.exit('Unknown command or missing expected date')
 print(json.dumps(result,ensure_ascii=False,indent=2))
