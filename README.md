# 논문 심사실 — GitHub Pages + Supabase 독립 운영본

2026-10-23 사용자 지시에 따라 OpenAI Sites 호스팅에서 독립하는 이전본이다. GitHub Pages가 정적 화면을 제공하고, 별도의 논문용 Supabase 프로젝트가 원문 자료와 메모를 저장한다. GPT API, ChatGPT 로그인, Sites 저장소를 운영에 사용하지 않는다. 아직 이 독립본을 원격 배포한 것은 아니다.

## 유지하는 내용

- 인간 최종본 1021_1559 PDF 279쪽, 각주 246개, 연결 참고자료 221개.
- 좌우 분할 조절, 본문 각주 이동, 실제 확인한 구간의 노란 강조, 인용 취지와 검증 한계, 연구자 이력.
- 로그인 화면 없는 열람. 개인 메모는 기본 비공개, 작성자가 선택한 메모만 공유한다.
- 메모는 기준 원고와 함께 저장하며, 작성자만 수정·삭제하고 동시 수정 충돌을 검사한다.
- 공개 메모 열람에는 방문자 계정 생성이 필요 없다. 개인 메모는 Supabase 익명 세션으로 브라우저에 귀속된다. 브라우저 데이터를 지우면 개인 메모에 접근할 수 없으므로 내보내기 기능을 제공한다.
- 검색 제외 메타 태그와 robots.txt. 이는 접근 제한이 아니며 누구나 주소로 열람할 수 있다.

## 배포 전에 필요한 연결

1. 사용자 소유 GitHub에 논문용 별도 저장소를 준비한다. 기존 lawinus.org 저장소를 덮어쓰지 않는다.
2. 사용자 소유 Supabase에 논문용 별도 프로젝트를 준비한다. 사용자는 기존 민법위키 프로젝트 재사용을 선택하지 않았다.
3. Supabase SQL Editor에서 `supabase/001_paper_review.sql`을 적용한다. 관련 테이블·RPC·공개 자료 버킷만 생성한다.
4. 해당 별도 프로젝트에서 익명 로그인을 활성화한다. 이 과정은 방문자에게 이메일·비밀번호를 요구하는 것이 아니다.
5. 프로젝트 URL과 **publishable 키**를 공개 설정에 넣는다. 관리자 service_role/secret 키는 화면·GitHub·public/config.json에 넣지 않는다.
6. 자료 업로드 도구를 관리자가 실행하고 원격 파일의 해시까지 검증한다.
7. 정적 빌드를 gh-pages 브랜치에 게시하고 실제 공개 문서 읽기·메모 권한 검증을 마친 뒤 DNS를 전환한다.

논문용 GitHub 저장소와 별도 Supabase 프로젝트를 준비했다. 현재 GitHub 인증의 Pages 설정·Actions 변수 권한은 제한되어 있으므로 최초 Pages 활성화는 저장소 설정 화면에서 진행한다. 저장소에 소스를 올리는 것과 Pages 주소가 실제로 열리는 것은 구별한다.

## 실행

Node 22.13 이상에서:

```text
npm ci
npm run build
```

개발할 때 `public/config.example.json`을 `public/config.json`으로 복사하고 실제 논문용 프로젝트의 공개 연결값을 넣는다. 이 파일은 소스 브랜치의 Git 제외 대상이다. 정적 빌드에는 프로젝트 URL과 publishable 키만 담긴 `config.json`을 포함하며 관리자 키는 넣지 않는다.

현재 배포 방식은 **소스 main / 정적 결과 gh-pages**이다. 저장소 Settings → Pages에서 Source를 **Deploy from a branch**, Branch를 **gh-pages**, 폴더를 **/(root)**로 선택한다. 첫 배포는 CNAME 없이 프로젝트 경로에서 확인하고, 도메인 연결은 검증 후 진행한다. 정적 결과에 `.nojekyll`을 포함한다.

향후 GitHub Actions로 자동 배포하려면 `docs/pages-workflow.example.yml`을 `.github/workflows/pages.yml`로 옮기고, 저장소 Variables에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 Pages의 Source를 GitHub Actions로 바꾼다. 현재 예제 파일은 실행되지 않는다.

## 자료 이전

`scripts/prepare-assets.py`는 기존 배포 대상 파일의 존재·크기·해시와 246각주·221자료 대응을 검사한다. 원문을 GitHub 소스 폴더로 복사하지 않고 `work/upload-plan.private.json`만 만든다. `work/`와 `*.private.json`은 배포에서 제외한다.

```text
python scripts/prepare-assets.py
node scripts/upload-assets.mjs work/upload-plan.private.json
```

두 번째 명령은 관리자가 환경변수 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정한 상태에서만 실행한다. 기존 객체를 덮어쓰지 않으며 이미 같은 경로에 있는 자료는 해시가 같은 경우에만 건너뛴다. 관리자 키는 출력하지 않는다. manifest는 자료 파일 다음에 등록한다. 실제 업로드 결과는 `work/upload-results.json`에서 확인한다.

## 기존 메모

기존 Sites 방문자 키와 ChatGPT 계정 ID는 새 Supabase 방문자 ID와 자동으로 대응하지 않는다. 이번 이전본에는 기존 개인 메모를 임의로 공개하거나 다른 사람에게 귀속하는 코드를 넣지 않았다. 전환 전 실제 메모 존재 여부를 확인하고 백업·작성자별 내보내기·필요한 소유자 매핑을 완료해야 한다. 이는 아직 완료되지 않았다.

## DNS 전환

이전의 `custom-domains.chatgpt.site` CNAME과 두 TXT 안내는 **기존 Sites용**이다. 이번 GitHub 운영에는 그 두 TXT를 추가할 필요가 없다. 기존 사이트에서 자료를 확인할 수 있도록 현재 레코드는 이전본 검증 전까지 급하게 바꾸지 않는다.

논문용 GitHub Pages가 `law-test` 계정에 배포되는 것이 확정되면, GitHub의 Custom domain 설정 후 닷홈의 기존 `paper` CNAME 값을 `law-test.github.io`로 바꾼다. CNAME에 저장소명이나 경로를 붙이지 않는다. 계정이 다르면 그 계정의 실제 Pages 호스트를 사용한다. GitHub 자체에서 별도 도메인 소유권 확인을 요구하는 경우에는 그 화면의 실제 TXT 값을 사용한다. SSL 인증서는 GitHub Pages에서 발급·확인한다.

참고: [GitHub Pages 도메인 연결](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Supabase 익명 세션](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase Storage 접근 관리](https://supabase.com/docs/guides/storage/security/access-control).

