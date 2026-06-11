'use strict';

const PaymentsModule = (() => {
  let _tab = 'all';
  let _filterMonth = '';

  function render() {
    const today = Utils.todayStr();
    _filterMonth = _filterMonth || today.substring(0, 7);

    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="fas fa-won-sign"></i> 수납 관리</h1>
        <button class="btn btn-primary" onclick="PaymentsModule.openAdd()">
          <i class="fas fa-plus"></i> 수납 등록
        </button>
      </div>
      <div class="tab-header">
        <button class="tab-btn ${_tab==='all'?'active':''}"    onclick="PaymentsModule.setTab('all')">전체 내역</button>
        <button class="tab-btn ${_tab==='unpaid'?'active':''}" onclick="PaymentsModule.setTab('unpaid')">미납/만료 회원</button>
        <button class="tab-btn ${_tab==='monthly'?'active':''}" onclick="PaymentsModule.setTab('monthly')">월별 집계</button>
      </div>
      <div id="payTab"></div>`;
    renderTab();
  }

  function renderTab() {
    const el = document.getElementById('payTab');
    if (!el) return;
    if (_tab === 'all')     renderAll(el);
    if (_tab === 'unpaid')  renderUnpaid(el);
    if (_tab === 'monthly') renderMonthly(el);
  }

  function renderAll(el) {
    const payments = DB.payments.all().sort((a,b) => b.date.localeCompare(a.date));
    if (!payments.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>수납 내역이 없습니다.</p></div>`;
      return;
    }

    let html = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <label style="font-size:.85rem;font-weight:600;color:var(--text-sub);">기간 필터:</label>
        <input type="month" class="form-control" style="width:170px;padding:7px 10px;"
          value="${_filterMonth}" onchange="PaymentsModule.setMonth(this.value)">
        <span class="badge badge-green" style="font-size:.82rem;">총 ${payments.length}건</span>
      </div>
      <div class="payment-list">`;

    const filtered = _filterMonth
      ? payments.filter(p => p.date && p.date.startsWith(_filterMonth))
      : payments;

    if (!filtered.length) {
      el.innerHTML = html + `</div><div class="empty-state" style="padding:30px 0"><i class="fas fa-receipt"></i><p>해당 기간에 수납 내역이 없습니다.</p></div>`;
      return;
    }

    filtered.forEach(p => {
      const m = DB.members.get(p.memberId);
      html += `
        <div class="payment-row">
          <div class="payment-icon"><i class="fas fa-receipt"></i></div>
          <div>
            <div style="font-weight:700">${m ? m.name : '(삭제된 회원)'}</div>
            <div style="font-size:.78rem;color:var(--text-sub)">
              ${Utils.fmtDate(p.date)} · ${Utils.methodLabel(p.method)}
              ${p.periodStart ? ` · ${Utils.fmtDate(p.periodStart)} ~ ${Utils.fmtDate(p.periodEnd)}` : ''}
            </div>
            ${p.memo ? `<div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${p.memo}</div>` : ''}
          </div>
          <div class="payment-amount">${Utils.fmtMoney(p.amount)}</div>
          <div style="display:flex;gap:6px;">
            <button class="icon-btn" onclick="PaymentsModule.openEdit('${p.id}')"><i class="fas fa-pen"></i></button>
            <button class="icon-btn" style="color:var(--red-dark)" onclick="PaymentsModule.deletePayment('${p.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    });

    const total = filtered.reduce((s, p) => s + (p.amount||0), 0);
    html += `</div>
      <div style="text-align:right;margin-top:14px;font-size:.95rem;">
        합계: <strong style="color:var(--accent-dark);font-size:1.1rem">${Utils.fmtMoney(total)}</strong>
      </div>`;
    el.innerHTML = html;
  }

  function renderUnpaid(el) {
    DB.members.refreshStatus();
    const members = DB.members.all().filter(m =>
      m.paymentStatus === 'unpaid' || m.paymentStatus === 'expired' || m.paymentStatus === 'expiring'
    );
    if (!members.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--accent-dark)"></i><p>미납 회원이 없습니다! 🎉</p></div>`;
      return;
    }

    const grouped = { expiring: [], expired: [], unpaid: [] };
    members.forEach(m => { if (grouped[m.paymentStatus]) grouped[m.paymentStatus].push(m); });

    let html = '';
    const labels = { expiring:'만료 임박 (7일 이내)', expired:'수강 만료됨', unpaid:'미납 / 수강 기간 없음' };
    const icons  = { expiring:'fas fa-clock', expired:'fas fa-times-circle', unpaid:'fas fa-exclamation-circle' };
    const colors = { expiring:'var(--yellow-dark)', expired:'var(--red-dark)', unpaid:'var(--secondary-dark)' };

    ['expiring','expired','unpaid'].forEach(status => {
      if (!grouped[status].length) return;
      html += `<div style="margin-bottom:20px;">
        <h3 style="font-size:.9rem;font-weight:700;color:${colors[status]};margin-bottom:10px;display:flex;align-items:center;gap:7px;">
          <i class="${icons[status]}"></i>${labels[status]} (${grouped[status].length}명)
        </h3>
        <div class="member-list">`;
      grouped[status].forEach(m => {
        const days = Utils.daysUntil(m.periodEnd);
        html += `
          <div class="member-row ${status}" style="cursor:default;">
            ${Utils.avatarHtml(m.name)}
            <div class="member-info">
              <div class="flex items-center gap-8" style="flex-wrap:wrap;">
                <span class="member-name">${m.name}</span>
                ${Utils.ageBadge(m.ageGroup)}
              </div>
              <div class="member-meta">${m.phone||'-'} · 월 ${Utils.fmtMoney(m.monthlyFee)}</div>
              <div style="font-size:.78rem;color:${colors[status]};margin-top:3px;">
                ${status==='expiring' ? `${days}일 후 만료 (${Utils.fmtDate(m.periodEnd)})` :
                  status==='expired'  ? `${Utils.fmtDate(m.periodEnd)} 만료됨` : '수강 기간 미설정'}
              </div>
            </div>
            <div class="member-actions">
              <button class="btn btn-success btn-sm" onclick="PaymentsModule.openAddForMember('${m.id}')">
                <i class="fas fa-plus"></i> 수납
              </button>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    });
    el.innerHTML = html;
  }

  function renderMonthly(el) {
    const payments = DB.payments.all();
    const byMonth = {};
    payments.forEach(p => {
      const ym = p.date ? p.date.substring(0,7) : '미상';
      if (!byMonth[ym]) byMonth[ym] = { total: 0, count: 0 };
      byMonth[ym].total += p.amount || 0;
      byMonth[ym].count++;
    });
    const months = Object.keys(byMonth).sort().reverse();
    if (!months.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>수납 데이터가 없습니다.</p></div>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${months.map(ym => `
          <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;">
            <div>
              <div style="font-weight:700;font-size:1rem">${ym.replace('-','년 ')}월</div>
              <div style="font-size:.82rem;color:var(--text-sub)">${byMonth[ym].count}건 수납</div>
            </div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--accent-dark)">${Utils.fmtMoney(byMonth[ym].total)}</div>
          </div>`).join('')}
      </div>`;
  }

  /* ── 수납 등록 ──────────────────────────── */
  function openAdd(presetMemberId) {
    Utils.openModal('수납 등록', payFormHtml(null, presetMemberId),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="PaymentsModule.saveAdd()"><i class="fas fa-save"></i> 등록</button>`
    );
  }

  function openAddForMember(memberId) { openAdd(memberId); }

  function saveAdd() {
    const data = collectPayForm();
    if (!data) return;
    DB.payments.create({ ...data, id: Utils.uuid() });
    if (data.memberId) {
      DB.members.update(data.memberId, {
        lastPaymentDate: data.date,
        periodStart:     data.periodStart,
        periodEnd:       data.periodEnd,
        paymentStatus:   'paid'
      });
      DB.members.refreshStatus();
    }
    Utils.closeModal();
    Utils.toast('수납이 등록되었습니다.', 'success');
    render();
  }

  function openEdit(id) {
    const p = DB.payments.get(id);
    if (!p) return;
    Utils.openModal('수납 내역 수정', payFormHtml(p),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="PaymentsModule.saveEdit('${id}')"><i class="fas fa-save"></i> 저장</button>`
    );
  }

  function saveEdit(id) {
    const data = collectPayForm();
    if (!data) return;
    DB.payments.update(id, data);
    Utils.closeModal();
    Utils.toast('수납 내역이 수정되었습니다.', 'success');
    renderTab();
  }

  function deletePayment(id) {
    Utils.confirm('이 수납 내역을 삭제하시겠습니까?', () => {
      DB.payments.delete(id);
      Utils.toast('삭제되었습니다.', 'warning');
      renderTab();
    });
  }

  /* ── 폼 HTML ────────────────────────────── */
  function payFormHtml(p, presetMemberId) {
    const members = DB.members.all().sort((a,b) => a.name.localeCompare(b.name,'ko'));
    const selectedId = p ? p.memberId : (presetMemberId || '');
    const selectedMember = selectedId ? DB.members.get(selectedId) : null;

    const periodEnd = p ? p.periodEnd : (selectedMember ? Utils.addMonths(Utils.todayStr(),1) : '');
    const periodStart = p ? p.periodStart : Utils.todayStr();

    return `
      <div class="form-group">
        <label class="form-label">회원 <span class="required">*</span></label>
        <select class="form-control" id="pMemberId" onchange="PaymentsModule.onMemberChange(this.value)">
          <option value="">회원 선택</option>
          ${members.map(m =>
            `<option value="${m.id}" ${m.id===selectedId?'selected':''}>${m.name} (${Utils.ageLabel(m.ageGroup)})</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">결제일 <span class="required">*</span></label>
          <input class="form-control" id="pDate" type="date" value="${p ? p.date : Utils.todayStr()}">
        </div>
        <div class="form-group">
          <label class="form-label">결제 금액 <span class="required">*</span></label>
          <input class="form-control" id="pAmount" type="number" value="${p ? p.amount : (selectedMember ? selectedMember.monthlyFee : '')}" placeholder="150000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">결제 수단</label>
        <select class="form-control" id="pMethod">
          <option value="cash"     ${(!p||p.method==='cash')?'selected':''}>현금</option>
          <option value="card"     ${p&&p.method==='card'?'selected':''}>카드</option>
          <option value="transfer" ${p&&p.method==='transfer'?'selected':''}>계좌이체</option>
          <option value="other"    ${p&&p.method==='other'?'selected':''}>기타</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">수강 시작일</label>
          <input class="form-control" id="pPeriodStart" type="date" value="${periodStart}">
        </div>
        <div class="form-group">
          <label class="form-label">수강 종료일</label>
          <input class="form-control" id="pPeriodEnd" type="date" value="${periodEnd}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">메모</label>
        <input class="form-control" id="pMemo" value="${p ? (p.memo||'') : ''}" placeholder="비고사항">
      </div>`;
  }

  function onMemberChange(memberId) {
    const m = DB.members.get(memberId);
    if (!m) return;
    const amtEl = document.getElementById('pAmount');
    if (amtEl && !amtEl.value) amtEl.value = m.monthlyFee || '';
    const endEl = document.getElementById('pPeriodEnd');
    if (endEl && !endEl.value) endEl.value = Utils.addMonths(Utils.todayStr(), 1);
    const startEl = document.getElementById('pPeriodStart');
    if (startEl && !startEl.value) startEl.value = Utils.todayStr();
  }

  function collectPayForm() {
    const memberId = document.getElementById('pMemberId')?.value;
    const date     = document.getElementById('pDate')?.value;
    const amount   = parseInt(document.getElementById('pAmount')?.value);
    if (!memberId) { Utils.toast('회원을 선택해주세요.', 'warning'); return null; }
    if (!date)     { Utils.toast('결제일을 입력해주세요.', 'warning'); return null; }
    if (!amount)   { Utils.toast('결제 금액을 입력해주세요.', 'warning'); return null; }
    return {
      memberId,
      date,
      amount,
      method:      document.getElementById('pMethod')?.value || 'cash',
      periodStart: document.getElementById('pPeriodStart')?.value || '',
      periodEnd:   document.getElementById('pPeriodEnd')?.value || '',
      memo:        document.getElementById('pMemo')?.value.trim() || ''
    };
  }

  function setTab(t)   { _tab = t; renderTab(); }
  function setMonth(m) { _filterMonth = m; renderTab(); }

  return { render, setTab, setMonth, openAdd, openAddForMember, saveAdd, openEdit, saveEdit, deletePayment, onMemberChange };
})();
