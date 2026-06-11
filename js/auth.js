'use strict';

const Auth = (() => {
  // 비밀번호를 SHA-256 해시로만 저장 (평문 없음)
  const ADMIN_ID   = 'admin';
  const PASS_HASH  = '600dcae6028c9e6121e06a6311cecf89293f9951605fd88b6a4b370c7e6357fd';
  const SESSION_KEY = 'haruon_auth';

  /* SHA-256 해시 계산 (Web Crypto API) */
  async function sha256(str) {
    const buf  = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* 로그인 여부 확인 */
  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === 'ok';
  }

  /* 로그아웃 */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  }

  /* 로그인 시도 */
  async function tryLogin() {
    const idEl   = document.getElementById('loginId');
    const pwEl   = document.getElementById('loginPw');
    const errEl  = document.getElementById('loginError');
    const btnEl  = document.getElementById('loginBtn');

    const id = idEl.value.trim();
    const pw = pwEl.value;

    if (!id || !pw) {
      showError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 확인 중...';

    const inputHash = await sha256(pw);

    if (id === ADMIN_ID && inputHash === PASS_HASH) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      hideLoginScreen();
    } else {
      btnEl.disabled = false;
      btnEl.innerHTML = '<i class="fas fa-sign-in-alt"></i> 로그인';
      showError('아이디 또는 비밀번호가 올바르지 않습니다.');
      pwEl.value = '';
      pwEl.focus();
      // 실패 시 입력란 흔들기
      document.getElementById('loginCard').classList.add('shake');
      setTimeout(() => document.getElementById('loginCard').classList.remove('shake'), 500);
    }
  }

  function showError(msg) {
    const el = document.getElementById('loginError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  /* 로그인 화면 표시 */
  function showLoginScreen() {
    let screen = document.getElementById('loginScreen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'loginScreen';
      document.body.appendChild(screen);
    }
    screen.innerHTML = loginScreenHtml();
    screen.style.display = 'flex';

    // Enter 키로 로그인
    screen.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') tryLogin();
      });
    });
    // 비밀번호 표시 토글
    document.getElementById('togglePw').addEventListener('click', () => {
      const pw = document.getElementById('loginPw');
      const ic = document.getElementById('togglePwIcon');
      if (pw.type === 'password') {
        pw.type = 'text';
        ic.className = 'fas fa-eye-slash';
      } else {
        pw.type = 'password';
        ic.className = 'fas fa-eye';
      }
    });
    document.getElementById('loginId').focus();
  }

  /* 로그인 화면 숨기기 + 앱 초기화 */
  function hideLoginScreen() {
    const screen = document.getElementById('loginScreen');
    if (screen) {
      screen.classList.add('login-fade-out');
      setTimeout(() => { screen.remove(); App.init(); }, 350);
    }
  }

  /* 로그인 화면 HTML */
  function loginScreenHtml() {
    return `
      <div class="login-bg">
        <div class="login-card" id="loginCard">
          <div class="login-logo">
            <span style="font-size:3rem;">🎨</span>
            <h1 class="login-title">하루온</h1>
            <p class="login-subtitle">미술 교습소 관리 시스템</p>
          </div>
          <div class="login-form">
            <div class="login-field">
              <label class="login-label">아이디</label>
              <div class="login-input-wrap">
                <i class="fas fa-user login-input-icon"></i>
                <input type="text" id="loginId" class="login-input" placeholder="아이디 입력" autocomplete="username">
              </div>
            </div>
            <div class="login-field">
              <label class="login-label">비밀번호</label>
              <div class="login-input-wrap">
                <i class="fas fa-lock login-input-icon"></i>
                <input type="password" id="loginPw" class="login-input" placeholder="비밀번호 입력" autocomplete="current-password">
                <button type="button" id="togglePw" class="pw-toggle-btn">
                  <i class="fas fa-eye" id="togglePwIcon"></i>
                </button>
              </div>
            </div>
            <p id="loginError" class="login-error" style="display:none;"></p>
            <button id="loginBtn" class="login-btn" onclick="Auth.tryLogin()">
              <i class="fas fa-sign-in-alt"></i> 로그인
            </button>
          </div>
          <p class="login-footer-note">
            <i class="fas fa-shield-alt"></i> 관리자 전용 시스템입니다.
          </p>
          <div class="login-version">
            <span>v1.0.3</span>
            <span class="login-version-dot">·</span>
            <span>최종 업데이트 2026.06.11</span>
          </div>
          <div class="login-version" style="margin-top:4px;">
            <i class="fas fa-heart" style="color:var(--primary);font-size:.65rem;"></i>
            <span>Developed by 승후, 승현 아빠</span>
          </div>
        </div>
      </div>`;
  }

  /* 앱 시작 시 인증 확인 */
  function guard() {
    if (!isLoggedIn()) {
      showLoginScreen();
      return false;
    }
    return true;
  }

  return { guard, isLoggedIn, logout, tryLogin, showLoginScreen };
})();
