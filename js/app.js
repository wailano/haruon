'use strict';

const App = (() => {
  let _page = 'dashboard';

  async function init() {
    showFbLoading(true);
    // Firebase 초기화 및 데이터 로드
    FirebaseSync.init();
    await FirebaseSync.loadAll();
    // 다른 기기에서 변경 시 현재 페이지 자동 갱신
    FirebaseSync.startListeners(colName => {
      DB.members.refreshStatus();
      navigate(_page);
    });
    showFbLoading(false);
    setupNav();
    setupModal();
    setupSidebar();
    setupDataIO();
    DB.members.refreshStatus();
    navigate('dashboard');
  }

  function showFbLoading(show) {
    let el = document.getElementById('fbLoading');
    if (show) {
      if (el) return;
      el = document.createElement('div');
      el.id = 'fbLoading';
      el.style.cssText = `position:fixed;inset:0;background:rgba(255,255,255,0.92);z-index:8000;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
        font-family:'Noto Sans KR',sans-serif;`;
      el.innerHTML = `
        <div style="font-size:2.5rem;">🎨</div>
        <div style="font-size:1rem;font-weight:700;color:#C06898;">하루온</div>
        <div style="width:40px;height:40px;border:3px solid #F8E4F2;border-top-color:#E8A4C8;
          border-radius:50%;animation:fbSpin 0.8s linear infinite;"></div>
        <div style="font-size:0.82rem;color:#8A8280;">데이터 불러오는 중...</div>
        <style>@keyframes fbSpin{to{transform:rotate(360deg)}}</style>`;
      document.body.appendChild(el);
    } else {
      if (el) { el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(()=>el.remove(),300); }
    }
  }

  /* ── 네비게이션 ─────────────────────────── */
  function setupNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigate(el.dataset.page);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
  }

  function navigate(page) {
    _page = page;
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    switch (page) {
      case 'dashboard':  renderDashboard(); break;
      case 'members':    MembersModule.render(); break;
      case 'payments':   PaymentsModule.render(); break;
      case 'classes':    ClassesModule.render(); break;
      case 'calendar':   CalendarModule.render(); break;
      case 'attendance': AttendanceModule.render(); break;
    }
    document.getElementById('pageContent').scrollTop = 0;
    window.scrollTo(0,0);
  }

  /* ── 대시보드 ────────────────────────────── */
  function renderDashboard() {
    DB.members.refreshStatus();
    const members  = DB.members.all();
    const payments = DB.payments.all();
    const today    = Utils.todayStr();
    const ym       = today.substring(0,7);
    const dow      = Utils.getDow(today);

    const totalMembers  = members.length;
    const expiring      = members.filter(m => m.paymentStatus === 'expiring').length;
    const expired       = members.filter(m => m.paymentStatus === 'expired').length;
    const unpaid        = members.filter(m => m.paymentStatus === 'unpaid').length;
    const monthPayments = payments.filter(p => p.date && p.date.startsWith(ym));
    const monthTotal    = monthPayments.reduce((s,p) => s+(p.amount||0), 0);
    const todayAtt      = DB.attendance.byDate(today);
    const presentToday  = todayAtt.filter(a=>a.status==='present').length;
    const todayMembers  = members.filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    );

    const alerts = members
      .filter(m => m.paymentStatus === 'expiring' || m.paymentStatus === 'expired' || m.paymentStatus === 'unpaid')
      .sort((a,b) => {
        const order = { expiring:0, expired:1, unpaid:2 };
        return (order[a.paymentStatus]||3) - (order[b.paymentStatus]||3);
      }).slice(0, 8);

    const recentPayments = payments
      .sort((a,b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">
          <i class="fas fa-home"></i> 대시보드
        </h1>
        <span style="font-size:.88rem;color:var(--text-sub);">${Utils.fmtDateKR(today)} (${Utils.DAYS[dow]}요일)</span>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon pink"><i class="fas fa-users"></i></div>
          <div>
            <div class="stat-label">전체 회원</div>
            <div class="stat-value">${totalMembers}<span class="stat-unit">명</span></div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('payments')">
          <div class="stat-icon green"><i class="fas fa-won-sign"></i></div>
          <div>
            <div class="stat-label">${ym.replace('-','.')} 수납액</div>
            <div class="stat-value" style="font-size:1.25rem">${Utils.fmtMoney(monthTotal).replace('원','')}<span class="stat-unit">원</span></div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('attendance')">
          <div class="stat-icon blue"><i class="fas fa-clipboard-check"></i></div>
          <div>
            <div class="stat-label">오늘 출석 / 예정</div>
            <div class="stat-value">${presentToday}<span class="stat-unit"> / ${todayMembers.length}명</span></div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer;${(expiring+expired+unpaid)>0?'border-color:var(--yellow-dark)':''}"
          onclick="App.navigate('payments')">
          <div class="stat-icon ${(expiring+expired+unpaid)>0?'yellow':'green'}">
            <i class="fas fa-${(expiring+expired+unpaid)>0?'exclamation-triangle':'check-circle'}"></i>
          </div>
          <div>
            <div class="stat-label">요주의 회원</div>
            <div class="stat-value" style="color:${(expiring+expired+unpaid)>0?'var(--yellow-dark)':'var(--accent-dark)'}">
              ${expiring+expired+unpaid}<span class="stat-unit">명</span>
            </div>
          </div>
        </div>
      </div>

      ${alerts.length ? `
        <div class="dashboard-alert">
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-bell"></i> 알림 · 주의 회원</div>
              <button class="btn btn-ghost btn-sm" onclick="App.navigate('payments')">전체 보기</button>
            </div>
            <div class="alert-list">
              ${alerts.map(m => {
                const days = Utils.daysUntil(m.periodEnd);
                let cls = '', msg = '';
                if (m.paymentStatus==='expiring') { cls='expiring'; msg=`${days}일 후 만료 (${Utils.fmtDate(m.periodEnd)})`; }
                else if (m.paymentStatus==='expired') { cls='expired'; msg=`수강 만료됨 (${Utils.fmtDate(m.periodEnd)})`; }
                else { cls='unpaid'; msg='수강 기간 미설정'; }
                return `<div class="alert-item ${cls}">
                  ${Utils.avatarHtml(m.name)}
                  <div style="flex:1;">
                    <strong>${m.name}</strong> ${Utils.ageBadge(m.ageGroup)}
                    <div style="font-size:.8rem;margin-top:2px;">${msg}</div>
                  </div>
                  <button class="btn btn-success btn-sm" onclick="PaymentsModule.openAddForMember('${m.id}');App.navigate('payments')">
                    <i class="fas fa-plus"></i> 수납
                  </button>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>` : ''}

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-clock"></i> 오늘 수업 (${Utils.DAYS[dow]}요일)</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('attendance')">출석 체크</button>
          </div>
          ${todayMembers.length
            ? `<div style="display:flex;flex-direction:column;gap:8px;">
                ${todayMembers.map(m => {
                  const att = todayAtt.find(a=>a.memberId===m.id);
                  const badge = att ? (att.status==='present'?'badge-green':att.status==='absent'?'badge-red':'badge-yellow') : 'badge-gray';
                  const label = att ? (att.status==='present'?'출석':att.status==='absent'?'결석':'보강') : '미확인';
                  const sch = m.weeklySchedule && m.weeklySchedule.find(s=>s.day===dow);
                  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
                    ${Utils.avatarHtml(m.name)}
                    <div style="flex:1;">
                      <span style="font-weight:600">${m.name}</span>
                      <span class="badge ${Utils.ageBadge(m.ageGroup).match(/badge-\w+/)[0]}" style="margin-left:6px;font-size:.7rem">${Utils.ageLabel(m.ageGroup)}</span>
                      <div style="font-size:.76rem;color:var(--text-sub)">${sch?sch.time:''}</div>
                    </div>
                    <span class="badge ${badge}">${label}</span>
                  </div>`;
                }).join('')}
              </div>`
            : `<p style="color:var(--text-muted);font-size:.87rem;padding:8px 0">오늘(${Utils.DAYS[dow]}요일) 수업 예정 회원이 없습니다.</p>`}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-receipt"></i> 최근 수납</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('payments')">전체 보기</button>
          </div>
          ${recentPayments.length
            ? `<div style="display:flex;flex-direction:column;gap:0;">
                ${recentPayments.map(p => {
                  const m = DB.members.get(p.memberId);
                  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
                    <div class="payment-icon" style="width:34px;height:34px;font-size:.85rem;"><i class="fas fa-receipt"></i></div>
                    <div style="flex:1;">
                      <span style="font-weight:600">${m ? m.name : '-'}</span>
                      <div style="font-size:.76rem;color:var(--text-sub)">${Utils.fmtDate(p.date)} · ${Utils.methodLabel(p.method)}</div>
                    </div>
                    <span style="font-weight:700;color:var(--accent-dark)">${Utils.fmtMoney(p.amount)}</span>
                  </div>`;
                }).join('')}
              </div>`
            : `<p style="color:var(--text-muted);font-size:.87rem;padding:8px 0">수납 내역이 없습니다.</p>`}
        </div>
      </div>`;
  }

  /* ── 사이드바 ────────────────────────────── */
  function setupSidebar() {
    const menuBtn       = document.getElementById('menuBtn');
    const sidebarClose  = document.getElementById('sidebarClose');
    const overlay       = document.getElementById('sidebarOverlay');

    menuBtn      && menuBtn.addEventListener('click', openSidebar);
    sidebarClose && sidebarClose.addEventListener('click', closeSidebar);
    overlay      && overlay.addEventListener('click', closeSidebar);
  }
  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('open');
  }
  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
  }

  /* ── 모달 ────────────────────────────────── */
  function setupModal() {
    document.getElementById('modalClose')?.addEventListener('click', Utils.closeModal);
    document.getElementById('modalOverlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('modalOverlay')) Utils.closeModal();
    });
  }

  /* ── 데이터 내보내기/가져오기 ─────────── */
  function setupDataIO() {
    document.getElementById('headerExportBtn')?.addEventListener('click', exportData);
    document.getElementById('importFileInput')?.addEventListener('change', handleImport);
  }

  function exportData() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().slice(0,10);
    a.href     = url;
    a.download = `haruon_backup_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast('데이터 백업 파일을 다운로드했습니다.', 'success');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.members && !data.payments) throw new Error('올바른 백업 파일이 아닙니다.');
        Utils.confirm('기존 데이터를 모두 덮어씁니다. 계속하시겠습니까?', () => {
          DB.importAll(data);
          DB.members.refreshStatus();
          Utils.toast('데이터를 복원했습니다.', 'success');
          navigate(_page);
        });
      } catch {
        Utils.toast('파일을 읽는 중 오류가 발생했습니다.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  /* 전체 데이터 초기화 (Firestore + localStorage) */
  async function clearAllData() {
    Utils.confirm('⚠️ 모든 데이터(회원·수납·수업·출석)가 삭제됩니다.\n정말 초기화하시겠습니까?', async () => {
      showFbLoading(true);
      try {
        // 1) localStorage 즉시 삭제
        DB.clearAll();

        // 2) Firestore 전체 삭제 (리스너 먼저 중단)
        if (window.FirebaseSync) {
          FirebaseSync.stopListeners();
          const db = firebase.firestore();
          const cols = ['members','payments','classes','lessons','attendance'];
          for (const col of cols) {
            let snap = await db.collection(col).get();
            // 재시도: 캐시 데이터가 남아 있을 경우 서버에서 한 번 더 가져옴
            if (snap.empty) snap = await db.collection(col).get();
            if (!snap.empty) {
              const batch = db.batch();
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          }
        }

        showFbLoading(false);
        Utils.toast('모든 데이터가 초기화되었습니다. 새로고침합니다...', 'success');
        // 3) 1.5초 후 페이지 리로드 — 완전히 깨끗한 상태로 재시작
        setTimeout(() => location.reload(), 1500);
      } catch(e) {
        showFbLoading(false);
        console.error('[clearAllData]', e);
        Utils.toast('초기화 중 오류: ' + e.message, 'error');
      }
    });
  }

  return { init, navigate, exportData, clearAllData, closeSidebar };
})();

/* ── 로그아웃 버튼 추가 ─────────────────── */
function addLogoutBtn() {
  let btn = document.getElementById('logoutBtn');
  if (btn) return;
  btn = document.createElement('button');
  btn.id = 'logoutBtn';
  btn.className = 'logout-btn';
  btn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>로그아웃</span>';
  btn.addEventListener('click', () => {
    Utils.confirm('로그아웃 하시겠습니까?', () => Auth.logout());
  });
  document.body.appendChild(btn);
}

/* 앱 시작 */
document.addEventListener('DOMContentLoaded', () => {
  // 로그인 안 됐으면 로그인 화면 표시 후 중단
  if (!Auth.guard()) return;

  // 이미 로그인된 경우 바로 앱 실행
  App.init();
});

// Auth.hideLoginScreen() 에서 호출됨 (로그인 성공 후)
const _origInit = App.init.bind(App);
App.init = function() {
  _origInit();
  addLogoutBtn();
};
