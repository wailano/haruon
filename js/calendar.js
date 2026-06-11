'use strict';

const CalendarModule = (() => {
  let _year, _month, _selectedDate = null;

  function render() {
    const now = new Date();
    if (_year === undefined) { _year = now.getFullYear(); _month = now.getMonth(); }

    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="fas fa-calendar-alt"></i> 캘린더</h1>
      </div>
      <div class="card" style="padding:20px;">
        <div class="cal-nav">
          <button class="btn btn-ghost btn-sm" onclick="CalendarModule.prevMonth()">
            <i class="fas fa-chevron-left"></i>
          </button>
          <h2>${_year}년 ${_month+1}월</h2>
          <button class="btn btn-ghost btn-sm" onclick="CalendarModule.nextMonth()">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
      <div id="calDetail"></div>`;
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;

    const today = Utils.todayStr();
    const cells = Utils.calDates(_year, _month);
    const classes = DB.classes.all();
    const attendance = DB.attendance.all();

    let html = Utils.DAYS.map((d,i) =>
      `<div class="cal-head ${i===0?'sun':i===6?'sat':''}">${d}</div>`
    ).join('');

    cells.forEach(cell => {
      const dow = Utils.getDow(cell.date);
      const dayClasses = classes.filter(c =>
        c.schedule && c.schedule.some(s => s.day === dow)
      );
      const dayAtt = attendance.filter(a => a.date === cell.date);
      const presentCount = dayAtt.filter(a => a.status === 'present').length;

      const isToday   = cell.date === today;
      const isOther   = cell.other;
      const isSelected = cell.date === _selectedDate;

      let cellClass = 'cal-cell';
      if (isOther)    cellClass += ' other-month';
      if (isToday)    cellClass += ' today';
      if (isSelected) cellClass += ' selected';

      const dateStyle = dow === 0 ? 'sun' : dow === 6 ? 'sat' : '';

      html += `<div class="${cellClass}" onclick="CalendarModule.selectDate('${cell.date}')">
        <div class="cal-date ${dateStyle}">${parseInt(cell.date.split('-')[2])}</div>
        <div class="cal-events">
          ${dayClasses.slice(0,3).map(c =>
            `<div class="cal-event" style="background:${hexToLight(c.color)};color:${c.color ? darken(c.color) : 'var(--primary-dark)'}"
              title="${c.name}">${c.name}</div>`
          ).join('')}
          ${dayClasses.length > 3 ? `<div style="font-size:.65rem;color:var(--text-muted)">+${dayClasses.length-3}개</div>` : ''}
        </div>
        <div class="event-dot">
          ${dayClasses.slice(0,4).map(c => `<div class="e-dot" style="background:${c.color||'#E8A4C8'}"></div>`).join('')}
        </div>
        ${presentCount > 0 ? `<div style="font-size:.62rem;color:var(--accent-dark);margin-top:2px;">출석 ${presentCount}</div>` : ''}
      </div>`;
    });

    grid.innerHTML = html;

    if (_selectedDate) renderDateDetail(_selectedDate);
  }

  function selectDate(date) {
    _selectedDate = (_selectedDate === date) ? null : date;
    renderGrid();
    if (_selectedDate) renderDateDetail(_selectedDate);
    else document.getElementById('calDetail').innerHTML = '';
  }

  function renderDateDetail(date) {
    const el = document.getElementById('calDetail');
    if (!el) return;

    const dow = Utils.getDow(date);
    const dayClasses = DB.classes.all().filter(c => c.schedule && c.schedule.some(s => s.day === dow));
    const attList = DB.attendance.byDate(date);
    const members = DB.members.all();

    const membersOnDay = members.filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s => s.day === dow)
    );

    el.innerHTML = `
      <div class="cal-detail-panel">
        <h4><i class="fas fa-calendar-day" style="color:var(--primary-dark);margin-right:8px;"></i>
          ${Utils.fmtDateKR(date)} (${Utils.DAYS[dow]}요일)
          <button class="btn btn-success btn-sm" style="float:right;margin-top:-4px;"
            onclick="AttendanceModule.renderByDate('${date}');App.navigate('attendance')">
            <i class="fas fa-clipboard-check"></i> 출석 체크
          </button>
        </h4>

        ${dayClasses.length ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:.8rem;font-weight:700;color:var(--text-sub);margin-bottom:8px;">📚 수업</div>
            ${dayClasses.map(c => {
              const sch = c.schedule.find(s => s.day === dow);
              const enrolled = membersOnDay.filter(() => true);
              return `<div class="cal-detail-item">
                <div style="width:10px;height:10px;border-radius:50%;background:${c.color||'#E8A4C8'};flex-shrink:0;"></div>
                <div style="flex:1;"><strong>${c.name}</strong>
                  <span style="color:var(--text-sub);margin-left:8px;">${sch?sch.time:''} ${sch&&sch.duration?'('+sch.duration+'분)':''}</span>
                </div>
              </div>`;
            }).join('')}
          </div>` : '<p style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px;">이 날 예정된 수업이 없습니다.</p>'}

        ${membersOnDay.length ? `
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--text-sub);margin-bottom:8px;">👥 수업 예정 회원 (${membersOnDay.length}명)</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${membersOnDay.map(m => {
                const att = attList.find(a => a.memberId === m.id);
                const status = att ? att.status : null;
                const badge = status === 'present' ? 'badge-green' : status === 'absent' ? 'badge-red' : status === 'makeup' ? 'badge-yellow' : 'badge-gray';
                const label = status === 'present' ? '출석' : status === 'absent' ? '결석' : status === 'makeup' ? '보강' : '미확인';
                return `<span class="badge ${badge}" style="font-size:.78rem;">${m.name} · ${label}</span>`;
              }).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }

  function prevMonth() {
    if (_month === 0) { _year--; _month = 11; } else _month--;
    _selectedDate = null;
    render();
  }
  function nextMonth() {
    if (_month === 11) { _year++; _month = 0; } else _month++;
    _selectedDate = null;
    render();
  }

  /* 색상 유틸 */
  function hexToLight(hex) {
    if (!hex) return '#F8E4F2';
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},0.18)`;
  }
  function darken(hex) {
    if (!hex) return '#C06898';
    const r = Math.max(0, parseInt(hex.slice(1,3),16)-60);
    const g = Math.max(0, parseInt(hex.slice(3,5),16)-60);
    const b = Math.max(0, parseInt(hex.slice(5,7),16)-60);
    return `rgb(${r},${g},${b})`;
  }

  return { render, prevMonth, nextMonth, selectDate };
})();
