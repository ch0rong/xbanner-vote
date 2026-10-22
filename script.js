// ★ Google Apps Script 웹 앱 배포 후 받은 URL로 교체하세요.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzQtxxpJix5iB2iUu90jckMyPUNmVaUOH5hSc81hSM4mgmEzt5pcoE0T4BC958CuL8q/exec';

const OPTIONS = [1, 2, 3, 4];
const POLL_MS = 5000;               // 실시간 갱신 주기
const STORAGE_KEY = 'xbanner-vote';  // 브라우저당 1표 기록
const ADMIN_KEY = 'xbanner-admin';   // 관리자 로그인 (탭을 닫으면 해제)

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');
const toastEl = document.getElementById('toast');
const adminBtn = document.getElementById('adminBtn');

let myVote = readVote();
let isAdmin = readAdmin();
let sending = false;

// ---------- 카드 생성 ----------
OPTIONS.forEach((n) => {
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.option = n;
  card.innerHTML = `
    <div class="num">${n}</div>
    <button class="thumb" type="button" aria-label="${n}번 시안 크게 보기">
      <img src="image${n}.png" alt="${n}번 시안" width="450" height="1351" loading="lazy">
    </button>
    <button class="vote-btn" type="button">${n}번 투표하기</button>
    <div class="result">
      <div class="bar"><div class="bar-fill"></div></div>
      <div class="result-text"><span class="count">0명</span><span class="pct">0%</span></div>
    </div>
  `;
  card.querySelector('.thumb').addEventListener('click', () => openModal(n));
  card.querySelector('.vote-btn').addEventListener('click', () => vote(n));
  grid.appendChild(card);
});

applyVotedState();
applyAdminState();

// ---------- 투표 ----------
async function vote(n) {
  if (myVote || sending) return;
  if (!confirm(`${n}번 시안에 투표할까요? 한 번만 투표할 수 있어요.`)) return;

  sending = true;
  setButtonsDisabled(true);
  try {
    // text/plain 으로 보내야 CORS preflight 없이 GAS에 전달됩니다.
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'vote', option: n }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '투표 실패');

    myVote = n;
    saveVote(n);
    applyVotedState();
    render(data.counts);
    toast(`${n}번 시안에 투표했어요!`);
  } catch (err) {
    console.error(err);
    toast('투표 전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
    setButtonsDisabled(false);
  } finally {
    sending = false;
  }
}

// ---------- 현황 불러오기 ----------
async function loadCounts() {
  try {
    const res = await fetch(`${GAS_URL}?action=get&t=${Date.now()}`);
    const data = await res.json();
    if (data.ok) render(data.counts);
  } catch (err) {
    console.error(err);
    statusEl.textContent = '투표 현황을 불러오지 못했어요.';
  }
}

function render(counts) {
  const total = OPTIONS.reduce((sum, n) => sum + (Number(counts[n]) || 0), 0);
  const max = Math.max(...OPTIONS.map((n) => Number(counts[n]) || 0));

  OPTIONS.forEach((n) => {
    const c = Number(counts[n]) || 0;
    const pct = total ? Math.round((c / total) * 100) : 0;
    const card = grid.querySelector(`[data-option="${n}"]`);
    card.querySelector('.bar-fill').style.width = `${pct}%`;
    card.querySelector('.bar-fill').style.opacity = c === max && c > 0 ? 1 : 0.55;
    card.querySelector('.count').textContent = `${c}명`;
    card.querySelector('.pct').textContent = `${pct}%`;
  });

  if (isAdmin) statusEl.textContent = `[관리자] 총 ${total}명 참여`;
  else if (myVote) statusEl.textContent = `총 ${total}명 참여 · 내 선택: ${myVote}번`;
  else statusEl.textContent = `총 ${total}명 참여 · 마음에 드는 시안에 투표해 주세요`;
}

function applyVotedState() {
  if (!myVote) return;
  grid.classList.add('show-results');
  setButtonsDisabled(true);
  const card = grid.querySelector(`[data-option="${myVote}"]`);
  if (card) {
    card.classList.add('voted');
    card.querySelector('.vote-btn').textContent = '내가 투표한 시안';
  }
}

// ---------- 관리자 ----------
adminBtn.addEventListener('click', async () => {
  if (isAdmin) {
    isAdmin = false;
    saveAdmin(false);
    applyAdminState();
    loadCounts();
    toast('관리자 모드를 종료했어요.');
    return;
  }

  const password = prompt('관리자 비밀번호를 입력하세요.');
  if (!password) return;

  adminBtn.disabled = true;
  try {
    // 비밀번호는 GAS의 스크립트 속성(ADMIN_PASSWORD)과 비교합니다.
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'admin', password }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'unauthorized');

    isAdmin = true;
    saveAdmin(true);
    applyAdminState();
    render(data.counts);
    toast('관리자 모드로 결과를 표시합니다.');
  } catch (err) {
    console.error(err);
    toast('비밀번호가 올바르지 않아요.');
  } finally {
    adminBtn.disabled = false;
  }
});

function applyAdminState() {
  grid.classList.toggle('show-results', isAdmin || !!myVote);
  adminBtn.classList.toggle('on', isAdmin);
  adminBtn.textContent = isAdmin ? '관리자 로그아웃' : '관리자 결과보기';
}

function setButtonsDisabled(disabled) {
  grid.querySelectorAll('.vote-btn').forEach((b) => (b.disabled = disabled));
}

// ---------- 모달 ----------
function openModal(n) {
  modalImg.src = `image${n}.png`;
  modalImg.alt = `${n}번 시안 원본`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  modal.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

modal.addEventListener('click', (e) => {
  if (e.target !== modalImg) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---------- 유틸 ----------
function readVote() {
  try { return Number(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function saveVote(n) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch {}
}
function readAdmin() {
  try { return sessionStorage.getItem(ADMIN_KEY) === '1'; } catch { return false; }
}
function saveAdmin(on) {
  try {
    if (on) sessionStorage.setItem(ADMIN_KEY, '1');
    else sessionStorage.removeItem(ADMIN_KEY);
  } catch {}
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ---------- 시작 ----------
loadCounts();
setInterval(() => {
  if (!document.hidden) loadCounts();
}, POLL_MS);
