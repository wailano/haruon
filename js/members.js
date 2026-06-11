'use strict';

const MembersModule = (() => {
  let _filter = 'all';
  let _search = '';

  /* ── 메인 렌더 ─────────────────────────── */
  function render() {
    DB.members.refreshStatus();
    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="fas fa-users"></i> 회원 관리</h1>
        <button class="btn btn-primary" onclick="MembersModule.openAdd()">
          <i class="fas fa-plus"></i> 신규 등록
        </button>
      </div>
      <div class="filter-bar">
        <div class="search-wrap">
          <i class="fas fa-search"></i>
          <input class="search-input" id="memberSearch" placeholder="이름 또는 연락처 검색..."
            value="${_search}" oninput="MembersModule.onSearch(this.value)">
        </div>
        <div class="filter-tabs">
          ${['all','kindergarten','elementary','middle','adult'].map(k => `
            <button class="filter-tab ${_filter===k?'active':''}" onclick="MembersModule.setFilter('${k}')">
              ${k==='all'?'전체':Utils.ageLabel(k)}
            </button>`).join('')}
        </div>
      </div>
      <div id="memberList"></div>`;
    renderList();
  }

  function renderList() {
    DB.members.refreshStatus();
    let list = DB.members.all();
    if (_filter !== 'all') list = list.filter(m => m.ageGroup === _filter);
    if (_search) {
      const q = _search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.phone||'').includes(q) ||
        (m.guardianPhone||'').includes(q)
      );
    }
    list.sort((a,b) => a.name.localeCompare(b.name, 'ko'));

    const el = document.getElementById('memberList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>등록된 회원이 없습니다.</p></div>`;
      return;
    }

    el.innerHTML = `<div class="member-list">${list.map(m => memberRow(m)).join('')}</div>`;
  }

  function memberRow(m) {
    const days = Utils.daysUntil(m.periodEnd);
    let rowClass = '';
    if (m.paymentStatus === 'expired')  rowClass = 'expired';
    if (m.paymentStatus === 'expiring') rowClass = 'expiring';

    const statusInfo = (() => {
      if (m.paymentStatus === 'expired')  return `<span style="color:var(--red-dark);font-size:.78rem">만료됨</span>`;
      if (m.paymentStatus === 'expiring') return `<span style="color:var(--yellow-dark);font-size:.78rem">⚠ ${days}일 후 만료</span>`;
      if (m.periodEnd) return `<span style="color:var(--text-muted);font-size:.78rem">${Utils.fmtDate(m.periodEnd)}까지</span>`;
      return `<span style="color:var(--text-muted);font-size:.78rem">수강 기간 미설정</span>`;
    })();

    return `
      <div class="member-row ${rowClass}">
        ${Utils.avatarHtml(m.name)}
        <div class="member-info">
          <div class="flex items-center gap-8" style="flex-wrap:wrap;">
            <span class="member-name">${m.name}</span>
            ${Utils.ageBadge(m.ageGroup)}
            ${Utils.payBadge(m.paymentStatus)}
          </div>
          <div class="member-meta">
            ${m.phone || '-'}
            ${m.guardianPhone ? ' · 보호자: '+m.guardianPhone : ''}
            · ${Utils.fmtSchedule(m.weeklySchedule)}
          </div>
          <div style="margin-top:3px">${statusInfo}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;">
          <div style="font-weight:700;color:var(--accent-dark)">${Utils.fmtMoney(m.monthlyFee)}</div>
          <div style="font-size:.76rem;color:var(--text-muted)">월 회비</div>
        </div>
        <div class="member-actions">
          <button class="icon-btn" title="상세보기" onclick="MembersModule.openDetail('${m.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="icon-btn" title="수정" onclick="MembersModule.openEdit('${m.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="icon-btn" title="삭제" style="color:var(--red-dark)"
            onclick="MembersModule.deleteMember('${m.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
  }

  function setFilter(f) { _filter = f; render(); }
  function onSearch(v)  { _search = v; renderList(); }

  /* ── 추가 폼 ────────────────────────────── */
  function openAdd() {
    Utils.openModal('신규 회원 등록', memberFormHtml(null),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="MembersModule.saveAdd()"><i class="fas fa-save"></i> 저장</button>`
    );
    initSchedulePicker('');
  }

  function saveAdd() {
    const data = collectForm();
    if (!data) return;
    const m = { ...data, id: Utils.uuid(), registrationDate: Utils.todayStr(), paymentStatus: 'unpaid' };
    DB.members.create(m);
    Utils.closeModal();
    Utils.toast('회원이 등록되었습니다.', 'success');
    render();
  }

  /* ── 수정 폼 ────────────────────────────── */
  function openEdit(id) {
    const m = DB.members.get(id);
    if (!m) return;
    Utils.openModal('회원 정보 수정', memberFormHtml(m),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="MembersModule.saveEdit('${id}')"><i class="fas fa-save"></i> 저장</button>`
    );
    initSchedulePicker(m.weeklySchedule || []);
  }

  function saveEdit(id) {
    const data = collectForm();
    if (!data) return;
    DB.members.update(id, data);
    Utils.closeModal();
    Utils.toast('회원 정보가 수정되었습니다.', 'success');
    render();
  }

  /* ── 상세 보기 ──────────────────────────── */
  function openDetail(id) {
    const m = DB.members.get(id);
    if (!m) return;
    const pays = DB.payments.byMember(id);
    const attList = DB.attendance.byMember(id);
    const presentCount = attList.filter(a => a.status === 'present').length;
    const absCount     = attList.filter(a => a.status === 'absent').length;
    const makeupCount  = attList.filter(a => a.status === 'makeup').length;
    const rate = attList.length ? Math.round(presentCount / attList.length * 100) : 0;

    const lastPay = pays.sort((a,b) => b.date.localeCompare(a.date))[0];

    Utils.openModal(`${m.name} 회원 상세`,
      `<div class="member-detail-grid">
        <div>
          <div class="detail-field"><div class="detail-field-label">이름</div><div class="detail-field-value">${m.name}</div></div>
          <div class="detail-field"><div class="detail-field-label">연령구분</div><div class="detail-field-value">${Utils.ageLabel(m.ageGroup)}</div></div>
          <div class="detail-field"><div class="detail-field-label">연락처</div><div class="detail-field-value">${m.phone||'-'}</div></div>
          <div class="detail-field"><div class="detail-field-label">보호자 연락처</div><div class="detail-field-value">${m.guardianPhone||'-'}</div></div>
          <div class="detail-field"><div class="detail-field-label">가입일</div><div class="detail-field-value">${Utils.fmtDate(m.registrationDate)}</div></div>
        </div>
        <div>
          <div class="detail-field"><div class="detail-field-label">월 회비</div><div class="detail-field-value" style="color:var(--accent-dark);font-weight:700">${Utils.fmtMoney(m.monthlyFee)}</div></div>
          <div class="detail-field"><div class="detail-field-label">수강 기간</div><div class="detail-field-value">${Utils.fmtDate(m.periodStart)} ~ ${Utils.fmtDate(m.periodEnd)}</div></div>
          <div class="detail-field"><div class="detail-field-label">결제 상태</div><div class="detail-field-value">${Utils.payBadge(m.paymentStatus)}</div></div>
          <div class="detail-field"><div class="detail-field-label">수업 일정</div><div class="detail-field-value">${Utils.fmtSchedule(m.weeklySchedule)}</div></div>
          <div class="detail-field"><div class="detail-field-label">최근 수납일</div><div class="detail-field-value">${lastPay ? Utils.fmtDate(lastPay.date) : '-'}</div></div>
        </div>
      </div>
      <div class="card mt-16">
        <div class="card-title mb-12"><i class="fas fa-chart-bar"></i> 출석 현황</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.88rem;margin-bottom:10px;">
          <span style="color:var(--accent-dark)"><b>${presentCount}</b> 출석</span>
          <span style="color:var(--red-dark)"><b>${absCount}</b> 결석</span>
          <span style="color:var(--yellow-dark)"><b>${makeupCount}</b> 보강</span>
          <span>출석률 <b>${rate}%</b></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${rate}%"></div></div>
      </div>
      ${m.memo ? `<div class="card mt-12"><div class="detail-field-label">메모</div><div style="font-size:.88rem;margin-top:4px">${m.memo}</div></div>` : ''}`,
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">닫기</button>
       <button class="btn btn-primary" onclick="Utils.closeModal();MembersModule.openEdit('${id}')">수정</button>`
    );
  }

  /* ── 삭제 ───────────────────────────────── */
  function deleteMember(id) {
    const m = DB.members.get(id);
    if (!m) return;
    Utils.confirm(`"${m.name}" 회원을 삭제하시겠습니까? 관련 수납/출석 기록도 함께 삭제됩니다.`, () => {
      DB.members.delete(id);
      DB.payments.all().filter(p => p.memberId === id).forEach(p => DB.payments.delete(p.id));
      DB.attendance.all().filter(a => a.memberId === id).forEach(a => DB.attendance.delete(a.id));
      Utils.toast('회원이 삭제되었습니다.', 'warning');
      render();
    });
  }

  /* ── 폼 HTML ────────────────────────────── */
  function memberFormHtml(m) {
    const v = (field) => m ? (m[field] || '') : '';
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">이름 <span class="required">*</span></label>
          <input class="form-control" id="fName" value="${v('name')}" placeholder="홍길동">
        </div>
        <div class="form-group">
          <label class="form-label">연령구분 <span class="required">*</span></label>
          <select class="form-control" id="fAgeGroup">
            <option value="">선택</option>
            <option value="kindergarten" ${v('ageGroup')==='kindergarten'?'selected':''}>유치부</option>
            <option value="elementary"   ${v('ageGroup')==='elementary'?'selected':''}>초등부</option>
            <option value="middle"       ${v('ageGroup')==='middle'?'selected':''}>중등부</option>
            <option value="adult"        ${v('ageGroup')==='adult'?'selected':''}>성인</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">연락처</label>
          <input class="form-control" id="fPhone" value="${v('phone')}" placeholder="010-0000-0000">
        </div>
        <div class="form-group">
          <label class="form-label">보호자 연락처</label>
          <input class="form-control" id="fGuardianPhone" value="${v('guardianPhone')}" placeholder="아동인 경우">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">월 회비</label>
          <input class="form-control" id="fMonthlyFee" type="number" value="${v('monthlyFee')}" placeholder="150000">
        </div>
        <div class="form-group" style="display:flex;flex-direction:column;">
          <label class="form-label">&nbsp;</label>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:.82rem;color:var(--text-sub);">
            <i class="fas fa-info-circle"></i> 수납 등록 시 자동 갱신됩니다
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">수강 시작일</label>
          <input class="form-control" id="fPeriodStart" type="date" value="${v('periodStart')}">
        </div>
        <div class="form-group">
          <label class="form-label">수강 종료일</label>
          <input class="form-control" id="fPeriodEnd" type="date" value="${v('periodEnd')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">주간 수업 요일</label>
        <div class="schedule-grid" id="dayPicker">
          ${Utils.DAYS.map((d,i) => `
            <div class="day-check">
              <input type="checkbox" id="dc${i}" name="dow" value="${i}">
              <label for="dc${i}">${d}</label>
            </div>`).join('')}
        </div>
        <div class="schedule-time-row" id="scheduleTimeRows"></div>
        <div class="form-hint">요일을 선택하면 시간을 입력할 수 있습니다.</div>
      </div>
      <div class="form-group">
        <label class="form-label">메모</label>
        <textarea class="form-control" id="fMemo" rows="2" placeholder="특이사항, 알레르기 등">${v('memo')}</textarea>
      </div>`;
  }

  function initSchedulePicker(existing) {
    const picker = document.getElementById('dayPicker');
    const timeRows = document.getElementById('scheduleTimeRows');
    if (!picker || !timeRows) return;

    const existingMap = {};
    (existing || []).forEach(s => { existingMap[s.day] = s.time; });

    picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const day = parseInt(cb.value);
      if (existingMap[day] !== undefined) cb.checked = true;
      cb.addEventListener('change', updateTimeRows);
    });
    updateTimeRows();

    function updateTimeRows() {
      const checked = [...picker.querySelectorAll('input:checked')].map(c => parseInt(c.value)).sort();
      if (checked.length) {
        timeRows.classList.add('visible');
        timeRows.innerHTML = checked.map(d => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:.78rem;font-weight:600;min-width:30px">${Utils.DAYS[d]}요일</span>
            <input class="form-control" id="dtime${d}" type="time"
              value="${existingMap[d] || '15:00'}" style="width:120px;padding:6px 8px;">
          </div>`).join('');
      } else {
        timeRows.classList.remove('visible');
        timeRows.innerHTML = '';
      }
    }
  }

  function collectForm() {
    const name = document.getElementById('fName')?.value.trim();
    const ageGroup = document.getElementById('fAgeGroup')?.value;
    if (!name) { Utils.toast('이름을 입력해주세요.', 'warning'); return null; }
    if (!ageGroup) { Utils.toast('연령구분을 선택해주세요.', 'warning'); return null; }

    const schedule = [];
    document.querySelectorAll('#dayPicker input:checked').forEach(cb => {
      const day = parseInt(cb.value);
      const timeEl = document.getElementById(`dtime${day}`);
      schedule.push({ day, time: timeEl ? timeEl.value : '15:00' });
    });

    return {
      name,
      ageGroup,
      phone:          document.getElementById('fPhone')?.value.trim() || '',
      guardianPhone:  document.getElementById('fGuardianPhone')?.value.trim() || '',
      monthlyFee:     parseInt(document.getElementById('fMonthlyFee')?.value) || 0,
      periodStart:    document.getElementById('fPeriodStart')?.value || '',
      periodEnd:      document.getElementById('fPeriodEnd')?.value || '',
      weeklySchedule: schedule,
      memo:           document.getElementById('fMemo')?.value.trim() || ''
    };
  }

  return { render, renderList, setFilter, onSearch, openAdd, saveAdd, openEdit, saveEdit, openDetail, deleteMember };
})();
