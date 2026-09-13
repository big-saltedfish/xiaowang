"""Fixed, bounded source-processing comparison. It does not measure investment accuracy."""
import datetime
import hashlib
import json
import sys
from urllib.parse import urlsplit,urlunsplit
VERSION='source-policy-v1'
RULES={'deduplicate','require_dates'}
def digest(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def policy(value):
 if not isinstance(value,dict) or set(value)!=RULES or any(type(v) is not bool for v in value.values()):raise ValueError('Only boolean deduplicate and require_dates rules are permitted')
 return value
def process(config,sources,as_of):
 config=policy(config);cutoff=datetime.date.fromisoformat(as_of)
 if not isinstance(sources,list) or not sources:raise ValueError('Real source records are required')
 ids=set();groups={};records=[];unresolved=[];seen=set();duplicates=0;undated=0
 for row in sources:
  if not isinstance(row,dict) or not isinstance(row.get('id'),str) or not row['id'] or row['id'] in ids:raise ValueError('Every source needs a unique id')
  if not isinstance(row.get('text'),str) or not row['text'].strip():raise ValueError('Exact source excerpts are required')
  ids.add(row['id']);url=row.get('url');canonical=None
  if url:
   parsed=urlsplit(url)
   if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:raise ValueError('Source URL must be public HTTPS without credentials')
   canonical=urlunsplit(('https',parsed.netloc.lower(),parsed.path.rstrip('/'),parsed.query,''))
  date=row.get('published_at');valid_date=False
  try:valid_date=datetime.date.fromisoformat(date)<=cutoff
  except (ValueError,TypeError):pass
  entry={'source_ids':[row['id']],'excerpts':[row['text']],'url':canonical,'published_at':date,'kind':row.get('kind','unknown'),'subjects':[row.get('subject','')]}
  if not valid_date and config['require_dates']:
   unresolved.append(entry);continue
  if not valid_date:undated+=1
  key=(canonical,date,row.get('kind')) if canonical else None
  if key and config['deduplicate'] and key in groups:
   groups[key]['source_ids'].append(row['id']);groups[key]['excerpts'].append(row['text']);groups[key]['subjects'].append(row.get('subject',''));continue
  if key in seen and key:duplicates+=1
  if key:seen.add(key);groups[key]=entry
  records.append(entry)
 retained=sorted(i for r in records+unresolved for i in r['source_ids'])
 return {'records':records,'unresolved_records':unresolved,'metrics':{'duplicate_evidence':duplicates,'undated_facts':undated,'unresolved':len(unresolved),'mixed_subject_groups':sum(len({s for s in r['subjects'] if s})>1 for r in records),'retained_source_ids':retained,'input_count':len(sources)}}
def evaluate(baseline,candidate,sources,as_of):
 before=process(baseline,sources,as_of);after=process(candidate,sources,as_of);b=before['metrics'];a=after['metrics']
 checks={'all_sources_preserved':a['retained_source_ids']==b['retained_source_ids'],'no_more_duplicate_evidence':a['duplicate_evidence']<=b['duplicate_evidence'],'no_more_undated_facts':a['undated_facts']<=b['undated_facts'],'no_mixed_subject_groups':a['mixed_subject_groups']<=b['mixed_subject_groups']}
 improvement=a['duplicate_evidence']<b['duplicate_evidence'] or a['undated_facts']<b['undated_facts']
 decision='trial' if all(checks.values()) and improvement else ('no_change' if all(checks.values()) else 'reject')
 return {'checker_version':VERSION,'scope':'source_processing_only','baseline_hash':digest(baseline),'candidate_hash':digest(candidate),'input_hash':digest(sources),'as_of':as_of,'checks':checks,'decision':decision,'baseline_metrics':b,'candidate_metrics':a,'candidate_output':after}
if __name__=='__main__':
 if len(sys.argv)!=5:sys.exit('Usage: method_gate.py BASELINE.json CANDIDATE.json SOURCES.json YYYY-MM-DD')
 with open(sys.argv[1]) as f:b=json.load(f)
 with open(sys.argv[2]) as f:c=json.load(f)
 with open(sys.argv[3]) as f:s=json.load(f)
 print(json.dumps(evaluate(b,c,s,sys.argv[4]),ensure_ascii=False,indent=2))
