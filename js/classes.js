'use strict';

const ClassesModule = (() => {
  let _tab = 'classes';

  const CLASS_COLORS = [
    '#E8A4C8','#A4C4E8','#A4E0C4','#F8DC88','#C8A8E8','#F4A0A0',
    '#A8D8A8','#F8B888','#88C8E8','#D8A8E8'
  ];

  function render() {
    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="fas fa-palette"></i> 수업 관리</h1>
        <div style="display:flex;gap:8px;">
          ${_tab === 'classes'
            ? `<button class="btn btn-primary" onclick="ClassesModule.openAddClass()"><i class="fas fa-plus"></i> 수업 추가</button>`
            : `<button class="btn btn-primary" onclick="ClassesModule.openAddLesson()"><i class="fas fa-plus"></i> 일지 작성</button>`}
        </div>
      </div>
      <div class="tab-header">
        <button class="tab-btn ${_tab==='classes'?'active':''}" onclick="ClassesModule.setTab('classes')">수업 목록</button>
        <button class="tab-btn ${_tab==='lessons'?'active':''}" onclick="ClassesModule.setTab('lessons')">수업 일지</button>
      </div>
      <div id="classTabContent"></div>`;
    renderTabContent();
  }

  function renderTabContent() {
    const el = document.getElementById('classTabContent');
    if (!el) return;
    _tab === 'classes' ? renderClasses(el) : renderLessons(el);
  }

  /* ── 수업 목록 ──────────────────────────── */
  function renderClasses(el) {
    const classes = DB.classes.all();
    if (!classes.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-palette"></i><p>등록된 수업이 없습니다.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="class-grid">${classes.map(c => classCard(c)).join('')}</div>`;
  }

  function classCard(c) {
    const members = DB.members.all().filter(m =>
      m.weeklySchedule && m.weeklySchedule.some(s =>
        c.schedule && c.schedule.some(cs => cs.day === s.day)
      )
    );
    return `
      <div class="class-card">
        <div class="class-card-header">
          <div class="class-color-dot" style="background:${c.color || '#E8A4C8'};width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:3px;"></div>
          <div style="flex:1;">
            <div class="class-card-name">${c.name}</div>
            ${c.ageGroup ? `<div style="margin-top:3px;">${Utils.ageBadge(c.ageGroup)}</div>` : ''}
          </div>
        </div>
        <div class="class-card-schedule">
          <i class="fas fa-clock" style="margin-right:5px;color:var(--text-muted)"></i>
          ${c.schedule && c.schedule.length
            ? c.schedule.map(s => `${Utils.DAYS[s.day]}요일 ${s.time}${s.duration?` (${s.duration}분)`:''}`).join(' · ')
            : '일정 미설정'}
        </div>
        ${c.description ? `<div style="font-size:.8rem;color:var(--text-sub);margin-bottom:10px;">${c.description}</div>` : ''}
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px;">
          수강 인원: <strong style="color:var(--text)">${members.length}명</strong>
        </div>
        <div class="class-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="ClassesModule.openEditClass('${c.id}')">
            <i class="fas fa-pen"></i> 수정
          </button>
          <button class="btn btn-ghost btn-sm" onclick="ClassesModule.deleteClass('${c.id}')">
            <i class="fas fa-trash"></i> 삭제
          </button>
          <button class="btn btn-secondary btn-sm" onclick="ClassesModule.openClassDetail('${c.id}')">
            <i class="fas fa-eye"></i> 상세
          </button>
        </div>
      </div>`;
  }

  /* ── 수업 일지 ──────────────────────────── */
  function renderLessons(el) {
    const lessons = DB.lessons.all().sort((a,b) => b.date.localeCompare(a.date));
    if (!lessons.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><p>수업 일지가 없습니다.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="lesson-list">${lessons.map(l => lessonRow(l)).join('')}</div>`;
  }

  function lessonRow(l) {
    const cls = DB.classes.get(l.classId);
    return `
      <div class="lesson-row">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${cls?cls.color:'#ccc'};margin-top:5px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="lesson-date">${Utils.fmtDate(l.date)} · ${cls ? cls.name : '(삭제된 수업)'}</div>
            <div class="lesson-topic">${l.topic || '제목 없음'}</div>
            ${l.content ? `<div class="lesson-content">${l.content}</div>` : ''}
            ${l.memberProgress && l.memberProgress.length
              ? `<div style="margin-top:8px;font-size:.76rem;color:var(--text-muted);">
                  진도: ${l.memberProgress.map(p => {
                    const m = DB.members.get(p.memberId);
                    return m ? `${m.name}: ${p.progress}` : '';
                  }).filter(Boolean).join(' · ')}</div>`
              : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="icon-btn" onclick="ClassesModule.openEditLesson('${l.id}')"><i class="fas fa-pen"></i></button>
            <button class="icon-btn" style="color:var(--red-dark)" onclick="ClassesModule.deleteLesson('${l.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }

  /* ── 수업 추가/수정 ─────────────────────── */
  function openAddClass() {
    Utils.openModal('수업 추가', classFormHtml(null),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="ClassesModule.saveAddClass()"><i class="fas fa-save"></i> 저장</button>`
    );
    initColorPicker('');
    initClassSchedulePicker([]);
  }

  function saveAddClass() {
    const data = collectClassForm();
    if (!data) return;
    DB.classes.create({ ...data, id: Utils.uuid() });
    Utils.closeModal();
    Utils.toast('수업이 추가되었습니다.', 'success');
    render();
  }

  function openEditClass(id) {
    const c = DB.classes.get(id);
    if (!c) return;
    Utils.openModal('수업 수정', classFormHtml(c),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="ClassesModule.saveEditClass('${id}')"><i class="fas fa-save"></i> 저장</button>`
    );
    initColorPicker(c.color || CLASS_COLORS[0]);
    initClassSchedulePicker(c.schedule || []);
  }

  function saveEditClass(id) {
    const data = collectClassForm();
    if (!data) return;
    DB.classes.update(id, data);
    Utils.closeModal();
    Utils.toast('수업이 수정되었습니다.', 'success');
    render();
  }

  function deleteClass(id) {
    const c = DB.classes.get(id);
    Utils.confirm(`"${c ? c.name : '수업'}"을 삭제하시겠습니까?`, () => {
      DB.classes.delete(id);
      Utils.toast('삭제되었습니다.', 'warning');
      render();
    });
  }

  function openClassDetail(id) {
    const c = DB.classes.get(id);
    if (!c) return;
    const lessons = DB.lessons.byClass(id).sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
    Utils.openModal(c.name + ' 상세',
      `<div style="margin-bottom:16px;">
        ${c.description ? `<p style="font-size:.9rem;color:var(--text-sub);margin-bottom:12px;">${c.description}</p>` : ''}
        <div class="detail-field"><div class="detail-field-label">연령구분</div><div class="detail-field-value">${Utils.ageLabel(c.ageGroup)}</div></div>
        <div class="detail-field"><div class="detail-field-label">수업 일정</div><div class="detail-field-value">${c.schedule && c.schedule.length ? c.schedule.map(s=>`${Utils.DAYS[s.day]}요일 ${s.time}${s.duration?' ('+s.duration+'분)':''}`).join(', ') : '-'}</div></div>
      </div>
      <h4 style="font-size:.9rem;font-weight:700;margin-bottom:10px;">최근 수업 일지</h4>
      ${lessons.length
        ? `<div class="lesson-list">${lessons.map(l => `
            <div class="lesson-row" style="padding:10px 12px;">
              <div class="lesson-date">${Utils.fmtDate(l.date)}</div>
              <div class="lesson-topic">${l.topic}</div>
              ${l.content ? `<div class="lesson-content">${l.content}</div>` : ''}
            </div>`).join('')}</div>`
        : `<p style="font-size:.85rem;color:var(--text-muted);">수업 일지가 없습니다.</p>`}`,
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">닫기</button>`
    );
  }

  /* ── 일지 추가/수정 ─────────────────────── */
  function openAddLesson(presetClassId) {
    Utils.openModal('수업 일지 작성', lessonFormHtml(null, presetClassId),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="ClassesModule.saveAddLesson()"><i class="fas fa-save"></i> 저장</button>`
    );
  }

  function saveAddLesson() {
    const data = collectLessonForm();
    if (!data) return;
    DB.lessons.create({ ...data, id: Utils.uuid() });
    Utils.closeModal();
    Utils.toast('수업 일지가 저장되었습니다.', 'success');
    render();
  }

  function openEditLesson(id) {
    const l = DB.lessons.get(id);
    if (!l) return;
    Utils.openModal('수업 일지 수정', lessonFormHtml(l),
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-primary" onclick="ClassesModule.saveEditLesson('${id}')"><i class="fas fa-save"></i> 저장</button>`
    );
  }

  function saveEditLesson(id) {
    const data = collectLessonForm();
    if (!data) return;
    DB.lessons.update(id, data);
    Utils.closeModal();
    Utils.toast('수업 일지가 수정되었습니다.', 'success');
    render();
  }

  function deleteLesson(id) {
    Utils.confirm('이 수업 일지를 삭제하시겠습니까?', () => {
      DB.lessons.delete(id);
      Utils.toast('삭제되었습니다.', 'warning');
      renderTabContent();
    });
  }

  /* ── 폼 HTML ────────────────────────────── */
  function classFormHtml(c) {
    const v = f => c ? (c[f] || '') : '';
    return `
      <div class="form-group">
        <label class="form-label">수업 이름 <span class="required">*</span></label>
        <input class="form-control" id="cName" value="${v('name')}" placeholder="예: 아동 수채화반">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">대상 연령</label>
          <select class="form-control" id="cAgeGroup">
            <option value="">전체</option>
            <option value="kindergarten" ${v('ageGroup')==='kindergarten'?'selected':''}>유치부</option>
            <option value="elementary"   ${v('ageGroup')==='elementary'?'selected':''}>초등부</option>
            <option value="middle"       ${v('ageGroup')==='middle'?'selected':''}>중등부</option>
            <option value="adult"        ${v('ageGroup')==='adult'?'selected':''}>성인</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">수업 색상</label>
          <div class="color-picker" id="colorPicker">
            ${CLASS_COLORS.map(col =>
              `<div class="color-swatch" data-color="${col}" style="background:${col}" onclick="ClassesModule.selectColor('${col}')"></div>`
            ).join('')}
          </div>
          <input type="hidden" id="cColor" value="${v('color') || CLASS_COLORS[0]}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">수업 설명</label>
        <input class="form-control" id="cDesc" value="${v('description')}" placeholder="수업 소개">
      </div>
      <div class="form-group">
        <label class="form-label">수업 일정</label>
        <div id="classSchedulePicker">
          <div class="schedule-grid" id="cDayPicker">
            ${Utils.DAYS.map((d,i) => `
              <div class="day-check">
                <input type="checkbox" id="cdc${i}" name="cdow" value="${i}">
                <label for="cdc${i}">${d}</label>
              </div>`).join('')}
          </div>
          <div class="schedule-time-row" id="cTimeRows"></div>
        </div>
      </div>`;
  }

  function initColorPicker(selected) {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(s => {
      if (s.dataset.color === selected) s.classList.add('selected');
    });
  }

  function selectColor(col) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    document.querySelectorAll(`[data-color="${col}"]`).forEach(s => s.classList.add('selected'));
    const inp = document.getElementById('cColor');
    if (inp) inp.value = col;
  }

  function initClassSchedulePicker(existing) {
    const picker = document.getElementById('cDayPicker');
    const timeRows = document.getElementById('cTimeRows');
    if (!picker || !timeRows) return;

    const existingMap = {};
    (existing||[]).forEach(s => {
      existingMap[s.day] = { time: s.time, duration: s.duration || 60 };
    });

    picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const day = parseInt(cb.value);
      if (existingMap[day]) cb.checked = true;
      cb.addEventListener('change', updateTimeRows);
    });
    updateTimeRows();

    function updateTimeRows() {
      const checked = [...picker.querySelectorAll('input:checked')].map(c=>parseInt(c.value)).sort();
      if (checked.length) {
        timeRows.classList.add('visible');
        timeRows.innerHTML = checked.map(d => {
          const def = existingMap[d] || {};
          return `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:.78rem;font-weight:600;min-width:30px">${Utils.DAYS[d]}요일</span>
              <input class="form-control" id="ctime${d}" type="time" value="${def.time||'15:00'}" style="width:120px;padding:6px 8px;">
              <input class="form-control" id="cdur${d}" type="number" value="${def.duration||60}" min="30" max="240" step="30"
                style="width:80px;padding:6px 8px;" placeholder="분">
              <span style="font-size:.76rem;color:var(--text-muted)">분</span>
            </div>`;
        }).join('');
      } else {
        timeRows.classList.remove('visible');
        timeRows.innerHTML = '';
      }
    }
  }

  function collectClassForm() {
    const name = document.getElementById('cName')?.value.trim();
    if (!name) { Utils.toast('수업 이름을 입력해주세요.', 'warning'); return null; }

    const schedule = [];
    document.querySelectorAll('#cDayPicker input:checked').forEach(cb => {
      const day = parseInt(cb.value);
      const timeEl = document.getElementById(`ctime${day}`);
      const durEl  = document.getElementById(`cdur${day}`);
      schedule.push({ day, time: timeEl ? timeEl.value : '15:00', duration: durEl ? parseInt(durEl.value)||60 : 60 });
    });

    return {
      name,
      ageGroup:    document.getElementById('cAgeGroup')?.value || '',
      description: document.getElementById('cDesc')?.value.trim() || '',
      color:       document.getElementById('cColor')?.value || CLASS_COLORS[0],
      schedule
    };
  }

  function lessonFormHtml(l, presetClassId) {
    const classes = DB.classes.all();
    const selectedId = l ? l.classId : (presetClassId || '');
    const members = DB.members.all().sort((a,b)=>a.name.localeCompare(b.name,'ko'));

    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">수업 <span class="required">*</span></label>
          <select class="form-control" id="lClassId">
            <option value="">수업 선택</option>
            ${classes.map(c => `<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">날짜 <span class="required">*</span></label>
          <input class="form-control" id="lDate" type="date" value="${l ? l.date : Utils.todayStr()}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">수업 주제 <span class="required">*</span></label>
        <input class="form-control" id="lTopic" value="${l ? (l.topic||'') : ''}" placeholder="오늘 수업 주제">
      </div>
      <div class="form-group">
        <label class="form-label">수업 내용</label>
        <textarea class="form-control" id="lContent" rows="3" placeholder="수업 진행 내용, 특이사항 등">${l ? (l.content||'') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">회원별 진도</label>
        <div style="display:flex;flex-direction:column;gap:8px;" id="lProgress">
          ${members.map(m => {
            const prog = l && l.memberProgress ? l.memberProgress.find(p=>p.memberId===m.id) : null;
            return `
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="min-width:60px;font-size:.85rem;font-weight:600">${m.name}</span>
                <input class="form-control" id="lp_${m.id}" value="${prog ? prog.progress : ''}"
                  placeholder="진도 메모" style="flex:1;">
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function collectLessonForm() {
    const classId = document.getElementById('lClassId')?.value;
    const date    = document.getElementById('lDate')?.value;
    const topic   = document.getElementById('lTopic')?.value.trim();
    if (!classId) { Utils.toast('수업을 선택해주세요.', 'warning'); return null; }
    if (!date)    { Utils.toast('날짜를 선택해주세요.', 'warning'); return null; }
    if (!topic)   { Utils.toast('수업 주제를 입력해주세요.', 'warning'); return null; }

    const memberProgress = [];
    document.querySelectorAll('[id^="lp_"]').forEach(el => {
      if (el.value.trim()) {
        memberProgress.push({ memberId: el.id.replace('lp_',''), progress: el.value.trim() });
      }
    });

    return { classId, date, topic, content: document.getElementById('lContent')?.value.trim()||'', memberProgress };
  }

  function setTab(t) { _tab = t; render(); }

  return {
    render, setTab,
    openAddClass, saveAddClass, openEditClass, saveEditClass, deleteClass, openClassDetail,
    openAddLesson, saveAddLesson, openEditLesson, saveEditLesson, deleteLesson,
    selectColor
  };
})();
