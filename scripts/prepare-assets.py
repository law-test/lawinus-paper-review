"""Validate the existing human dataset; create a local-only upload plan, without copying sources into Git."""
from pathlib import Path
import argparse, hashlib, json, re

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'work')
    parser.add_argument('--profile', type=Path, help='Current public profile JSON; never the private CV evidence file')
    args=parser.parse_args()
    base=args.source.resolve(); out=args.output.resolve()
    manifest_path=base/'data-pipeline/deploy-manifest.json'
    profile_path=(args.profile.resolve() if args.profile else base/'research/profile.public.current.json')
    assert profile_path.is_file(), '현재 공개 약력 파일이 없습니다. 이전 이력서로 대체하지 말고 --profile로 확인된 공개 JSON을 지정하세요.'
    map_path=base/'data-pipeline/deploy-assets.private.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8-sig'))
    assets=json.loads(map_path.read_text(encoding='utf-8-sig'))
    notes=manifest['notes']; sources=manifest['sources']
    assert len(notes)==246 and len(sources)==221 and len(manifest['pages'])==279, '기준본 수량이 달라졌습니다. 별도 검토 필요.'
    assert len({n['id'] for n in notes})==246, '각주 식별자 중복'
    assert len({s['id'] for s in sources})==221, '자료 식별자 중복'
    for path in (manifest_path,profile_path):
        text=path.read_text(encoding='utf-8-sig')
        assert not re.search(r'(?<![A-Za-z0-9])[A-Za-z]:[\\/]',text), '공개 JSON에 로컬 경로가 포함되어 있습니다.'
    plan=[]
    for id in ['thesis']+[s['id'] for s in sources if s.get('available') is not False]:
        assert id in assets, '자료 경로가 누락되었습니다: '+id
        a=assets[id]; p=Path(a['path'])
        assert p.is_file(), '자료 파일을 찾을 수 없습니다: '+id
        sha=digest(p); size=p.stat().st_size
        assert sha.lower()==a['sha256'].lower(), '해시가 달라졌습니다: '+id
        assert size==a['size'], '크기가 달라졌습니다: '+id
        plan.append({'id':id,'path':str(p.resolve()),'storageKey':'human-1021-1559/'+('human.pdf' if id=='thesis' else 'assets/'+id),'mime':a['mime'],'size':size,'sha256':sha})
    for id,p in [('profile',profile_path),('manifest',manifest_path)]:
        plan.append({'id':id,'path':str(p),'storageKey':'human-1021-1559/'+id+'.json','mime':'application/json','size':p.stat().st_size,'sha256':digest(p)})
    out.mkdir(parents=True,exist_ok=True)
    (out/'upload-plan.private.json').write_text(json.dumps({'datasetId':'human-1021-1559','items':plan},ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'humanPages':279,'footnotes':246,'sources':221,'files':len(plan),'totalBytes':sum(a['size'] for a in plan),'largestBytes':max(a['size'] for a in plan),'allHashesMatch':True,'uploaded':False,'manifestSha256':digest(manifest_path)}
    (out/'asset-preflight.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__': main()

