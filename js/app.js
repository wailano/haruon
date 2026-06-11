'use strict';

const App = (() => {
  let _page = 'dashboard';

  function init() {
    setupNav();
    setupModal();
    setupSidebar();
    setupDataIO();
    DB.members.refreshStatus();
    navigate('dashboard');
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

  /* 샘플 데이터 삽입 */
  function insertSampleData() {
    if (DB.members.all().length > 0) {
      Utils.toast('이미 데이터가 있습니다.', 'info');
      return;
    }

    const classId1 = Utils.uuid();
    const classId2 = Utils.uuid();
    const classId3 = Utils.uuid();

    DB.classes.create({ id: classId1, name: '아동 수채화반', ageGroup:'elementary', color:'#A4C4E8', description:'초등학생 대상 수채화 기초 과정', schedule:[{day:2,time:'15:30',duration:60},{day:4,time:'15:30',duration:60}] });
    DB.classes.create({ id: classId2, name: '유치부 창의미술', ageGroup:'kindergarten', color:'#E8A4C8', description:'유치원생 대상 창의적 미술 활동', schedule:[{day:1,time:'16:00',duration:50},{day:3,time:'16:00',duration:50}] });
    DB.classes.create({ id: classId3, name: '성인 소묘반', ageGroup:'adult', color:'#A4E0C4', description:'성인 대상 데생·소묘 기초~심화', schedule:[{day:3,time:'19:00',duration:90},{day:5,time:'10:00',duration:90}] });

    const m1 = Utils.uuid(), m2 = Utils.uuid(), m3 = Utils.uuid(), m4 = Utils.uuid(), m5 = Utils.uuid();

    DB.members.create({ id:m1, name:'김민준', ageGroup:'elementary', phone:'010-1234-5678', guardianPhone:'010-9876-5432', registrationDate:'2025-03-01', monthlyFee:150000, periodStart:'2026-06-01', periodEnd:'2026-06-30', paymentStatus:'paid', weeklySchedule:[{day:2,time:'15:30'},{day:4,time:'15:30'}], memo:'' });
    DB.members.create({ id:m2, name:'이서연', ageGroup:'kindergarten', phone:'', guardianPhone:'010-2222-3333', registrationDate:'2025-09-01', monthlyFee:120000, periodStart:'2026-06-01', periodEnd:'2026-06-08', paymentStatus:'expiring', weeklySchedule:[{day:1,time:'16:00'},{day:3,time:'16:00'}], memo:'물감 알레르기 주의' });
    DB.members.create({ id:m3, name:'박지훈', ageGroup:'adult', phone:'010-3333-4444', guardianPhone:'', registrationDate:'2024-12-01', monthlyFee:200000, periodStart:'2026-06-01', periodEnd:'2026-06-30', paymentStatus:'paid', weeklySchedule:[{day:3,time:'19:00'},{day:5,time:'10:00'}], memo:'' });
    DB.members.create({ id:m4, name:'최아린', ageGroup:'elementary', phone:'', guardianPhone:'010-5555-6666', registrationDate:'2026-01-15', monthlyFee:150000, periodStart:'2026-05-01', periodEnd:'2026-05-31', paymentStatus:'expired', weeklySchedule:[{day:2,time:'15:30'}], memo:'' });
    DB.members.create({ id:m5, name:'정하은', ageGroup:'adult', phone:'010-7777-8888', guardianPhone:'', registrationDate:'2026-04-01', monthlyFee:180000, periodStart:'', periodEnd:'', paymentStatus:'unpaid', weeklySchedule:[{day:5,time:'10:00'}], memo:'첫 등록 대기' });

    const today = Utils.todayStr();
    DB.payments.create({ id:Utils.uuid(), memberId:m1, date:'2026-06-01', amount:150000, method:'card', periodStart:'2026-06-01', periodEnd:'2026-06-30', memo:'' });
    DB.payments.create({ id:Utils.uuid(), memberId:m3, date:'2026-06-02', amount:200000, method:'transfer', periodStart:'2026-06-01', periodEnd:'2026-06-30', memo:'' });
    DB.payments.create({ id:Utils.uuid(), memberId:m2, date:'2026-05-03', amount:120000, method:'cash', periodStart:'2026-05-03', periodEnd:'2026-06-08', memo:'' });

    DB.lessons.create({ id:Utils.uuid(), classId:classId1, date:'2026-06-10', topic:'파란 하늘 수채화', content:'번지기 기법을 활용해 하늘과 구름 표현', memberProgress:[{memberId:m1,progress:'번지기 기법 익힘'},{memberId:m4,progress:'색 혼합 연습 중'}] });
    DB.lessons.create({ id:Utils.uuid(), classId:classId3, date:'2026-06-11', topic:'정물 소묘 - 사과', content:'원통형 물체 명암 표현법', memberProgress:[{memberId:m3,progress:'명암 3단계 완성'},{memberId:m5,progress:'기본 윤곽선 연습'}] });

    DB.attendance.upsert({ id:Utils.uuid(), memberId:m1, date:today, status:'present' });
    DB.attendance.upsert({ id:Utils.uuid(), memberId:m3, date:today, status:'present' });
    DB.attendance.upsert({ id:Utils.uuid(), memberId:m5, date:today, status:'absent' });

    DB.members.refreshStatus();
    Utils.toast('샘플 데이터가 삽입되었습니다.', 'success');
    navigate('dashboard');
  }

  return { init, navigate, exportData, insertSampleData, closeSidebar };
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

  if (DB.members.all().length === 0 && DB.classes.all().length === 0) {
    setTimeout(() => {
      Utils.openModal('하루온에 오신 것을 환영합니다! 🎨',
        `<div style="text-align:center;padding:10px 0;">
          <div style="font-size:3rem;margin-bottom:16px;">🎨</div>
          <p style="font-size:.95rem;color:var(--text-sub);line-height:1.7;margin-bottom:20px;">
            미술 교습소 관리 시스템 <strong>하루온</strong>에 오신 것을 환영합니다!<br>
            샘플 데이터로 시작하시거나, 직접 회원을 등록해 사용하실 수 있습니다.
          </p>
          <div style="background:var(--bg-alt);border-radius:var(--radius-sm);padding:14px;font-size:.83rem;color:var(--text-sub);text-align:left;margin-bottom:8px;">
            <strong>주요 기능</strong><br>
            👥 회원 관리 · 💳 수납 관리<br>
            🎨 수업 관리 · 📅 캘린더 · ✅ 출석 관리
          </div>
        </div>`,
        `<button class="btn btn-ghost" onclick="Utils.closeModal()">직접 시작</button>
         <button class="btn btn-primary" onclick="Utils.closeModal();App.insertSampleData()">
           <i class="fas fa-magic"></i> 샘플 데이터로 시작
         </button>`
      );
    }, 400);
  }
};
