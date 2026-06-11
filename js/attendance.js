'use strict';

const AttendanceModule = (() => {
  let _date = Utils.todayStr();
  let _tab  = 'daily';

  function render() {
    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="fas fa-clipboard-check"></i> 출석 관리</h1>
      </div>
      <div class="tab-header">
        <button class="tab-btn ${_tab==='daily'?'active':''}"  onclick="AttendanceModule.setTab('daily')">일별 출석</button>
        <button class="tab-btn ${_tab==='stats'?'active':''}"  onclick="AttendanceModule.setTab('stats')">출석 통계</button>
        <button class="tab-btn ${_tab==='member'?'active':''}" onclick="AttendanceModule.setTab('member')">회원별 이력</button>
      </div>
      <div id="attTabContent"></div>`;
    renderTab();
  }

  function renderTab() {
    const el = document.getElementById('attTabContent');
    if (!el) return;
    if (_tab === 'daily')  renderDaily(el);
    if (_tab === 'stats')  renderStats(el);
    if (_tab === 'member') renderMemberHistory(el);
  }

  /* ── 일별 출석 ──────────────────────────── */
  function renderDaily(el) {
    const dow = Utils.getDow(_date);
    const allMembers = DB.members.all();
    const todayMembers = allMembers.filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    ).sort((a,b) => a.name.localeCompare(b.name,'ko'));

    const attList = DB.attendance.byDate(_date);
    const presentCount = attList.filter(a=>a.status==='present').length;
    const absentCount  = attList.filter(a=>a.status==='absent').length;
    const makeupCount  = attList.filter(a=>a.status==='makeup').length;
    const totalCount   = todayMembers.length;

    el.innerHTML = `
      <div class="attendance-header">
        <div style="display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap;">
          <input type="date" class="form-control" id="attDatePicker" value="${_date}"
            onchange="AttendanceModule.setDate(this.value)" style="width:170px;padding:8px 10px;">
          <span style="font-weight:700;font-size:.95rem;">
            ${Utils.fmtDateKR(_date)} (${Utils.DAYS[dow]}요일)
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="AttendanceModule.markAll('present')">
            <i class="fas fa-check-double"></i> 전원 출석
          </button>
          <button class="btn btn-ghost btn-sm" onclick="AttendanceModule.autoGenerate()">
            <i class="fas fa-magic"></i> 자동 생성
          </button>
        </div>
      </div>

      <div class="att-summary">
        <div class="att-summary-item" style="background:var(--accent-light);color:var(--accent-dark);">
          <i class="fas fa-user-check"></i> 출석 ${presentCount}
        </div>
        <div class="att-summary-item" style="background:var(--red-light);color:var(--red-dark);">
          <i class="fas fa-user-times"></i> 결석 ${absentCount}
        </div>
        <div class="att-summary-item" style="background:var(--yellow-light);color:var(--yellow-dark);">
          <i class="fas fa-redo"></i> 보강 ${makeupCount}
        </div>
        <div class="att-summary-item" style="background:var(--bg-alt);color:var(--text-sub);">
          <i class="fas fa-users"></i> 예정 ${totalCount}명
        </div>
        ${totalCount>0 ? `
          <div class="att-summary-item" style="background:var(--primary-light);color:var(--primary-dark);">
            <i class="fas fa-percentage"></i> ${Math.round(presentCount/totalCount*100)}%
          </div>` : ''}
      </div>

      ${todayMembers.length === 0
        ? `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>${Utils.DAYS[dow]}요일 수업 예정인 회원이 없습니다.<br>회원 관리에서 수업 요일을 설정해주세요.</p></div>`
        : `<div class="att-grid" id="attGrid">${todayMembers.map(m => attRow(m, attList.find(a=>a.memberId===m.id))).join('')}</div>`}`;
  }

  function attRow(m, existing) {
    const status  = existing ? existing.status : null;
    const classes = DB.classes.all().filter(c =>
      c.schedule && c.schedule.some(s => s.day === Utils.getDow(_date))
    );
    const memberClass = classes[0]; // 간략 표시

    return `
      <div class="att-row" id="arow_${m.id}">
        ${Utils.avatarHtml(m.name)}
        <div class="att-name">${m.name}</div>
        <div class="att-class">${memberClass ? memberClass.name : ''} · ${Utils.ageLabel(m.ageGroup)}</div>
        <div class="att-status-btns">
          <button class="att-btn present ${status==='present'?'':'inactive'}"
            onclick="AttendanceModule.setStatus('${m.id}','present')">
            <i class="fas fa-check"></i> 출석
          </button>
          <button class="att-btn absent ${status==='absent'?'':'inactive'}"
            onclick="AttendanceModule.setStatus('${m.id}','absent')">
            <i class="fas fa-times"></i> 결석
          </button>
          <button class="att-btn makeup ${status==='makeup'?'':'inactive'}"
            onclick="AttendanceModule.setStatus('${m.id}','makeup')">
            <i class="fas fa-redo"></i> 보강
          </button>
        </div>
      </div>`;
  }

  function setStatus(memberId, status) {
    DB.attendance.upsert({
      id:       Utils.uuid(),
      memberId,
      date:     _date,
      status
    });
    const allMembers = DB.members.all();
    const dow = Utils.getDow(_date);
    const todayMembers = allMembers.filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    ).sort((a,b) => a.name.localeCompare(b.name,'ko'));
    const attList = DB.attendance.byDate(_date);
    const m = DB.members.get(memberId);

    const rowEl = document.getElementById(`arow_${memberId}`);
    if (rowEl && m) {
      const existing = attList.find(a=>a.memberId===memberId);
      rowEl.outerHTML = attRow(m, existing);
    }
    updateSummary(todayMembers, attList);
  }

  function updateSummary(todayMembers, attList) {
    const presentCount = attList.filter(a=>a.status==='present').length;
    const absentCount  = attList.filter(a=>a.status==='absent').length;
    const makeupCount  = attList.filter(a=>a.status==='makeup').length;
    const totalCount   = todayMembers.length;
    const summaryEl    = document.querySelector('.att-summary');
    if (!summaryEl) return;
    summaryEl.innerHTML = `
      <div class="att-summary-item" style="background:var(--accent-light);color:var(--accent-dark);"><i class="fas fa-user-check"></i> 출석 ${presentCount}</div>
      <div class="att-summary-item" style="background:var(--red-light);color:var(--red-dark);"><i class="fas fa-user-times"></i> 결석 ${absentCount}</div>
      <div class="att-summary-item" style="background:var(--yellow-light);color:var(--yellow-dark);"><i class="fas fa-redo"></i> 보강 ${makeupCount}</div>
      <div class="att-summary-item" style="background:var(--bg-alt);color:var(--text-sub);"><i class="fas fa-users"></i> 예정 ${totalCount}명</div>
      ${totalCount>0 ? `<div class="att-summary-item" style="background:var(--primary-light);color:var(--primary-dark);"><i class="fas fa-percentage"></i> ${Math.round(presentCount/totalCount*100)}%</div>` : ''}`;
  }

  function markAll(status) {
    const dow = Utils.getDow(_date);
    const todayMembers = DB.members.all().filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    );
    todayMembers.forEach(m => {
      DB.attendance.upsert({ id: Utils.uuid(), memberId: m.id, date: _date, status });
    });
    const el = document.getElementById('attTabContent');
    if (el) renderDaily(el);
    Utils.toast(`전원 ${status==='present'?'출석':'결석'} 처리되었습니다.`, 'success');
  }

  function autoGenerate() {
    const dow = Utils.getDow(_date);
    const todayMembers = DB.members.all().filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    );
    const existing = DB.attendance.byDate(_date).map(a => a.memberId);
    let count = 0;
    todayMembers.forEach(m => {
      if (!existing.includes(m.id)) {
        DB.attendance.upsert({ id: Utils.uuid(), memberId: m.id, date: _date, status: 'present' });
        count++;
      }
    });
    const el = document.getElementById('attTabContent');
    if (el) renderDaily(el);
    Utils.toast(`${count}명 자동 출석 처리되었습니다.`, 'info');
  }

  /* ── 출석 통계 ──────────────────────────── */
  function renderStats(el) {
    const members = DB.members.all();
    if (!members.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>회원이 없습니다.</p></div>`;
      return;
    }

    const now  = new Date();
    const ym   = `${now.getFullYear()}-${Utils.pad(now.getMonth()+1)}`;
    const monthAtt = DB.attendance.byMonth(ym);

    el.innerHTML = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;">
        <input type="month" class="form-control" id="statsMonth" value="${ym}"
          onchange="AttendanceModule.refreshStats(this.value)" style="width:180px;padding:8px 10px;">
        <span style="font-size:.88rem;color:var(--text-sub);">${ym.replace('-','년 ')}월 출석 현황</span>
      </div>
      <div class="att-stat-grid" id="attStatGrid">
        ${members.map(m => {
          const mAtt    = monthAtt.filter(a => a.memberId === m.id);
          const present = mAtt.filter(a=>a.status==='present').length;
          const absent  = mAtt.filter(a=>a.status==='absent').length;
          const makeup  = mAtt.filter(a=>a.status==='makeup').length;
          const total   = mAtt.length;
          const rate    = total ? Math.round(present/total*100) : 0;
          return `
            <div class="att-stat-card">
              <div class="att-stat-name">${m.name} ${Utils.ageBadge(m.ageGroup)}</div>
              <div class="att-stat-row"><span>출석</span><span style="color:var(--accent-dark);font-weight:700">${present}회</span></div>
              <div class="att-stat-row"><span>결석</span><span style="color:var(--red-dark)">${absent}회</span></div>
              <div class="att-stat-row"><span>보강</span><span style="color:var(--yellow-dark)">${makeup}회</span></div>
              <div class="progress-bar mt-8"><div class="progress-fill" style="width:${rate}%"></div></div>
              <div style="text-align:right;font-size:.76rem;color:var(--text-sub);margin-top:4px">출석률 ${rate}%</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function refreshStats(ym) {
    const members = DB.members.all();
    const monthAtt = DB.attendance.byMonth(ym);
    const grid = document.getElementById('attStatGrid');
    if (!grid) return;
    grid.innerHTML = members.map(m => {
      const mAtt    = monthAtt.filter(a => a.memberId === m.id);
      const present = mAtt.filter(a=>a.status==='present').length;
      const absent  = mAtt.filter(a=>a.status==='absent').length;
      const makeup  = mAtt.filter(a=>a.status==='makeup').length;
      const total   = mAtt.length;
      const rate    = total ? Math.round(present/total*100) : 0;
      return `
        <div class="att-stat-card">
          <div class="att-stat-name">${m.name} ${Utils.ageBadge(m.ageGroup)}</div>
          <div class="att-stat-row"><span>출석</span><span style="color:var(--accent-dark);font-weight:700">${present}회</span></div>
          <div class="att-stat-row"><span>결석</span><span style="color:var(--red-dark)">${absent}회</span></div>
          <div class="att-stat-row"><span>보강</span><span style="color:var(--yellow-dark)">${makeup}회</span></div>
          <div class="progress-bar mt-8"><div class="progress-fill" style="width:${rate}%"></div></div>
          <div style="text-align:right;font-size:.76rem;color:var(--text-sub);margin-top:4px">출석률 ${rate}%</div>
        </div>`;
    }).join('');
  }

  /* ── 회원별 이력 ────────────────────────── */
  function renderMemberHistory(el) {
    const members = DB.members.all().sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    if (!members.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>회원이 없습니다.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="form-group" style="max-width:280px;">
        <select class="form-control" id="histMemberSel" onchange="AttendanceModule.loadMemberHistory(this.value)">
          <option value="">회원 선택</option>
          ${members.map(m => `<option value="${m.id}">${m.name} (${Utils.ageLabel(m.ageGroup)})</option>`).join('')}
        </select>
      </div>
      <div id="memberHistoryContent"></div>`;
  }

  function loadMemberHistory(memberId) {
    const el = document.getElementById('memberHistoryContent');
    if (!el || !memberId) return;
    const m = DB.members.get(memberId);
    if (!m) return;

    const records = DB.attendance.byMember(memberId).sort((a,b)=>b.date.localeCompare(a.date));
    const present = records.filter(a=>a.status==='present').length;
    const absent  = records.filter(a=>a.status==='absent').length;
    const makeup  = records.filter(a=>a.status==='makeup').length;
    const rate    = records.length ? Math.round(present/records.length*100) : 0;

    el.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title mb-12"><i class="fas fa-user"></i> ${m.name} 출석 현황</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.9rem;margin-bottom:12px;">
          <span style="color:var(--accent-dark)"><b>${present}</b> 출석</span>
          <span style="color:var(--red-dark)"><b>${absent}</b> 결석</span>
          <span style="color:var(--yellow-dark)"><b>${makeup}</b> 보강</span>
          <span>총 <b>${records.length}</b>회 · 출석률 <b>${rate}%</b></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${rate}%"></div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${records.length ? records.slice(0,60).map(a => {
          const dow = Utils.getDow(a.date);
          const badge = a.status==='present' ? 'badge-green' : a.status==='absent' ? 'badge-red' : 'badge-yellow';
          const label = a.status==='present' ? '출석' : a.status==='absent' ? '결석' : '보강';
          return `<div style="display:flex;align-items:center;gap:12px;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);">
            <span style="min-width:90px;font-size:.85rem;">${Utils.fmtDate(a.date)}</span>
            <span style="font-size:.78rem;color:var(--text-sub)">${Utils.DAYS[dow]}요일</span>
            <span class="badge ${badge}">${label}</span>
          </div>`;
        }).join('') : `<p style="color:var(--text-muted);font-size:.88rem;">출석 기록이 없습니다.</p>`}
      </div>`;
  }

  function setDate(d) { _date = d; const el = document.getElementById('attTabContent'); if (el) renderDaily(el); }
  function setTab(t)  { _tab = t; renderTab(); }
  function renderByDate(date) { _date = date; _tab = 'daily'; }

  return { render, setDate, setTab, setStatus, markAll, autoGenerate, refreshStats, loadMemberHistory, renderByDate };
})();
