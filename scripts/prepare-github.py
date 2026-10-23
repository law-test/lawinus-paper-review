"""Prepare only the dedicated repository. Credentials stay in process memory.

This script never pushes source files, changes DNS, or edits another repository.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

OWNER = 'law-test'
REPO = 'lawinus-paper-review'
FULL_NAME = f'{OWNER}/{REPO}'
DESCRIPTION = 'Independent LAW IN US dissertation review room: GitHub Pages and Supabase.'
ROOT = Path(__file__).resolve().parents[1]


def credential() -> str:
    process_env = os.environ.copy()
    process_env['GIT_TERMINAL_PROMPT'] = '0'
    process_env['GCM_INTERACTIVE'] = 'Never'
    result = subprocess.run(
        ['git', '-c', 'credential.interactive=false', 'credential', 'fill'],
        input=f'protocol=https\nhost=github.com\nusername={OWNER}\n\n',
        capture_output=True, text=True, env=process_env, timeout=30,
    )
    fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if result.returncode or not fields.get('password'):
        raise RuntimeError('The expected GitHub credential is unavailable.')
    return fields['password']


def prepare(pages_only: bool = False) -> dict:
    config = json.loads((ROOT / 'public/config.json').read_text('utf-8-sig'))
    project_url = config.get('supabaseUrl', '')
    public_key = config.get('supabasePublishableKey', '')
    if project_url != 'https://cefaekvclooytgjkcqum.supabase.co':
        raise RuntimeError('The separate dissertation project must be configured.')
    if not public_key.startswith('sb_publishable_'):
        raise RuntimeError('Only the expected public publishable key may be published.')

    token = credential()

    def request(method: str, path: str, body=None):
        headers = {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2026-03-10',
            'User-Agent': 'lawinus-paper-review-deployment',
        }
        encoded = None if body is None else json.dumps(body).encode('utf-8')
        if encoded is not None:
            headers['Content-Type'] = 'application/json'
        try:
            with urllib.request.urlopen(urllib.request.Request(
                'https://api.github.com' + path, data=encoded, headers=headers, method=method
            ), timeout=45) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                data = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                data = {}
            return error.code, data

    status, user = request('GET', '/user')
    if status != 200 or user.get('login') != OWNER:
        raise RuntimeError('The authenticated account does not match the authorized owner.')
    base = f'/repos/{FULL_NAME}'
    status, repository = request('GET', base)
    created = False
    if status == 404:
        status, repository = request('POST', '/user/repos', {
            'name': REPO,
            'description': DESCRIPTION,
            'private': False,
            'has_issues': True,
            'has_projects': False,
            'has_wiki': False,
            'auto_init': False,
        })
        created = status == 201
    if status not in (200, 201) or repository.get('full_name') != FULL_NAME:
        raise RuntimeError(f'Dedicated repository creation failed (HTTP {status}): {repository.get("message", "Request rejected")}.')
    if repository.get('private') or repository.get('id') != 1430406211:
        raise RuntimeError('The repository is not the exact public repository created by the user. No changes applied.')
    if not repository.get('permissions', {}).get('admin'):
        # Creation responses may omit permissions; verify through the repository read endpoint.
        check_status, check = request('GET', base)
        if check_status != 200 or not check.get('permissions', {}).get('admin'):
            raise RuntimeError('Repository administration permission was not confirmed.')

    variables = []
    for name, value in ([] if pages_only else [('SUPABASE_URL', project_url), ('SUPABASE_PUBLISHABLE_KEY', public_key)]):
        state, state_body = request('GET', base + '/actions/variables/' + name)
        if state == 404:
            result, result_body = request('POST', base + '/actions/variables', {'name': name, 'value': value})
        elif state == 200:
            result, result_body = request('PATCH', base + '/actions/variables/' + name, {'name': name, 'value': value})
        else:
            raise RuntimeError(f'Variable metadata unavailable: {name} (HTTP {state}): {state_body.get("message", "Request rejected")}.')
        if result not in (201, 204):
            raise RuntimeError(f'Variable setting failed: {name} (HTTP {result}): {result_body.get("message", "Request rejected")}.')
        read_status, actual = request('GET', base + '/actions/variables/' + name)
        if read_status != 200 or actual.get('value') != value:
            raise RuntimeError(f'Variable read-back failed: {name}.')
        variables.append({'name': name, 'verified': True})

    pages_status, pages = request('GET', base + '/pages')
    if pages_status == 404:
        pages_status, pages = request('POST', base + '/pages', {'build_type': 'workflow'})
    if pages_status in (200, 201):
        change_status, _ = request('PUT', base + '/pages', {
            'build_type': 'workflow',
        })
        if change_status not in (200, 204):
            raise RuntimeError(f'Pages configuration failed (HTTP {change_status}).')
        pages_status, pages = request('GET', base + '/pages')
    report = {
        'repository': FULL_NAME,
        'repository_id': repository['id'],
        'repository_url': repository['html_url'],
        'created': created,
        'variables': variables,
        'pages_status_code': pages_status,
        'pages_configured': pages_status == 200 and pages.get('build_type') == 'workflow',
        'pages': {key: pages.get(key) for key in ['html_url', 'status', 'cname', 'build_type', 'https_enforced']},
        'source_pushed': False,
        'dns_modified': False,
    }
    if pages_status not in (200, 201):
        # Empty repositories can require an initial branch before Pages is enabled.
        report['pages_error'] = {'http_status': pages_status, 'message': pages.get('message', '')}
    (ROOT / 'work').mkdir(exist_ok=True)
    (ROOT / 'work/github-prepare-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', action='store_true', help='Create/configure only the authorized dedicated repository.')
    parser.add_argument('--pages-only', action='store_true', help='Check/configure Pages without setting Actions variables.')
    arguments = parser.parse_args()
    if not arguments.prepare:
        parser.error('--prepare is required; no remote changes were made.')
    print(json.dumps(prepare(pages_only=arguments.pages_only), ensure_ascii=False))
