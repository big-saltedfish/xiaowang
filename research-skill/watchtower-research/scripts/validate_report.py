"""Validate report structure and traceability fields, not financial accuracy."""
import datetime
import json
import sys
from urllib.parse import urlsplit


def validate(report):
    errors = []
    if not isinstance(report, dict):
        return ['Report must be an object']
    if report.get('schema_version') != 1:
        errors.append('schema_version must be 1')
    for field in ('title', 'summary'):
        if not isinstance(report.get(field), str) or not report[field].strip():
            errors.append(field + ' is required')
    try:
        report_date = datetime.date.fromisoformat(report.get('date', ''))
    except (ValueError, TypeError):
        errors.append('date must be YYYY-MM-DD')
        report_date = None
    sources = report.get('sources')
    if not isinstance(sources, list) or not sources:
        errors.append('No source evidence; do not claim a validated report')
        sources = []
    seen = set()
    for i, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f'sources[{i}] must be an object')
            continue
        if not isinstance(source.get('title'), str) or not source['title'].strip():
            errors.append(f'sources[{i}] needs a title')
        if source.get('kind') not in ('notice', 'news', 'company_profile', 'market_data', 'financial_data'):
            errors.append(f'sources[{i}] needs an explicit source kind')
        url = source.get('url')
        if url is not None:
            try:
                parsed = urlsplit(url)
                if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                    raise ValueError('invalid source URL')
                canonical = parsed.hostname.lower() + parsed.path.rstrip('/') + '?' + parsed.query
                if canonical in seen:
                    errors.append(f'sources[{i}] repeats an existing source URL')
                seen.add(canonical)
            except (ValueError, TypeError, AttributeError):
                errors.append(f'sources[{i}] URL must be HTTPS without credentials')
        try:
            source_date = datetime.date.fromisoformat(source.get('published_at', '')[:10])
            if report_date and source_date > report_date:
                errors.append(f'sources[{i}] is dated after the report')
        except (TypeError, ValueError):
            errors.append(f'sources[{i}] needs a valid publication/data date')
    fixed_checks = {
        'source_dates': bool(sources) and not any('dated after' in e or 'valid publication/data date' in e for e in errors),
        'unique_source_urls': bool(sources) and not any('repeats an existing' in e for e in errors),
        'source_fields': bool(sources) and not any(e.startswith('sources[') for e in errors),
    }
    questions = report.get('open_questions')
    if not isinstance(questions, list) or any(not isinstance(q, str) for q in questions):
        errors.append('open_questions must be a string array')
    changes = report.get('method_changes')
    if not isinstance(changes, list):
        errors.append('method_changes must be an array')
        changes = []
    for i, change in enumerate(changes):
        if not isinstance(change, dict):
            errors.append(f'method_changes[{i}] must be an object')
            continue
        for field in ('before', 'after', 'reason', 'evidence'):
            if not isinstance(change.get(field), str) or not change[field].strip():
                errors.append(f'method_changes[{i}] needs {field}')
        if change.get('status') not in ('candidate', 'validated'):
            errors.append(f'method_changes[{i}] has an unknown status')
        if change.get('status') == 'validated':
            checks = change.get('checks')
            if not isinstance(checks, list) or not checks:
                errors.append(f'method_changes[{i}] needs recorded fixed checks')
            elif any(not isinstance(c, dict) or c.get('name') not in fixed_checks or c.get('passed') is not True or not fixed_checks[c['name']] for c in checks):
                errors.append(f'method_changes[{i}] contains failed/invalid checks')
    return errors


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 validate_report.py REPORT.json')
    with open(sys.argv[1], encoding='utf-8') as stream:
        result = validate(json.load(stream))
    print(json.dumps({'scope': 'structure_and_traceability_only', 'passed': not result, 'errors': result}, ensure_ascii=False))
    sys.exit(1 if result else 0)
