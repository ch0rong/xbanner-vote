# 찾아가는 청년센터 x배너 투표

GitHub Pages(정적 페이지) + Google Apps Script + Google Sheets로 동작하는 실시간 시안 투표 페이지입니다.

## 파일 구성
| 파일 | 설명 |
|---|---|
| `index.html` | 페이지 구조 |
| `style.css` | 디자인 (Hippie 폰트, 4열 그리드, 모달, 막대 바) |
| `script.js` | 투표 전송 · 현황 불러오기(5초마다 자동 갱신) · 모달 |
| `Code.gs` | Google Apps Script 백엔드 (GitHub에 올리지 않아도 됨) |
| `image1~4.png` | 시안 이미지 (450×1351) |

## 1. Google Sheets + Apps Script 설정
1. Google Drive에서 **새 Google 스프레드시트**를 만듭니다.
2. 메뉴 **확장 프로그램 → Apps Script** 를 엽니다.
3. 기본 코드를 지우고 `Code.gs` 내용을 붙여넣은 뒤 저장합니다.
4. 오른쪽 위 **배포 → 새 배포** → 유형 **웹 앱** 선택
   - 실행 사용자: **나**
   - 액세스 권한: **모든 사용자**
5. 권한 승인 후 나오는 **웹 앱 URL**(`https://script.google.com/macros/s/.../exec`)을 복사합니다.
6. `script.js` 맨 위의 `GAS_URL` 값을 그 URL로 바꿉니다.

> `Code.gs`를 수정했다면 **배포 → 배포 관리 → 수정 → 새 버전**으로 다시 배포해야 반영됩니다.
> 투표 데이터는 스프레드시트의 `votes` 시트에 저장되며, 초기화하려면 B열 숫자를 0으로 바꾸면 됩니다.

## 관리자 결과보기
1. Apps Script **프로젝트 설정(톱니바퀴) → 스크립트 속성 → 속성 추가**
   - 속성: `ADMIN_PASSWORD` / 값: 원하는 비밀번호
2. 페이지 우측 상단 **관리자 결과보기** → 비밀번호 입력 → 투표하지 않아도 결과 표시
   - 비밀번호는 GAS가 확인하므로 공개 저장소에 노출되지 않습니다.
   - 로그인 상태는 탭을 닫으면 해제됩니다.

## 2. GitHub Pages 배포
1. 새 저장소에 `index.html`, `style.css`, `script.js`, `image1~4.png`를 업로드합니다.
2. 저장소 **Settings → Pages → Branch: main / (root)** 저장.
3. 잠시 후 `https://<아이디>.github.io/<저장소명>/` 에서 확인합니다.

## 동작 방식
- 투표 버튼 → `fetch` POST로 GAS에 전송 → 시트 카운트 +1 → 최신 집계를 응답받아 즉시 막대 바 표시
- 5초마다 GET으로 집계를 다시 불러와 다른 사람의 투표도 실시간 반영
- 중복 투표 방지: 브라우저 `localStorage`에 기록(1인 1표). 브라우저를 바꾸거나 기록을 지우면 다시 투표할 수 있는 간단한 방식입니다.
