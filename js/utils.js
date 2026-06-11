'use strict';

const Utils = (() => {
  /* UUID */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* 날짜 */
  const pad = n => String(n).padStart(2, '0');

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function fmtDate(s) {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
  }
  function fmtDateKR(s) {
    if (!s) return '-';
    const d = new Date(s);
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  }
  function daysUntil(s) {
    if (!s) return null;
    const end = new Date(s); end.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    return Math.ceil((end - now) / 86400000);
  }
  function yearMonth(s) { return s ? s.substring(0,7) : ''; }
  function addMonths(s, n) {
    const d = new Date(s);
    d.setMonth(d.getMonth() + n);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function getDow(s) { return new Date(s).getDay(); }

  /* 금액 */
  function fmtMoney(n) {
    return (n || 0).toLocaleString('ko-KR') + '원';
  }

  /* 상수 */
  const DAYS   = ['일','월','화','수','목','금','토'];
  const DAYS_EN= ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const AGE_MAP = { kindergarten:'유치부', elementary:'초등부', middle:'중등부', adult:'성인' };
  const PAY_MAP = { paid:'완납', unpaid:'미납', expiring:'만료임박', expired:'만료됨' };
  const METHOD_MAP = { cash:'현금', card:'카드', transfer:'계좌이체', other:'기타' };

  function ageLabel(g)    { return AGE_MAP[g] || g || '-'; }
  function payLabel(s)    { return PAY_MAP[s] || s || '-'; }
  function methodLabel(m) { return METHOD_MAP[m] || m || '-'; }

  function payBadge(s) {
    const cls = { paid:'badge-green', unpaid:'badge-blue', expiring:'badge-yellow', expired:'badge-red' };
    return `<span class="badge ${cls[s] || 'badge-gray'}">${payLabel(s)}</span>`;
  }
  function ageBadge(g) {
    const cls = { kindergarten:'badge-pink', elementary:'badge-blue', middle:'badge-purple', adult:'badge-green' };
    return `<span class="badge ${cls[g] || 'badge-gray'}">${ageLabel(g)}</span>`;
  }

  /* 스케줄 포맷 */
  function fmtSchedule(arr) {
    if (!arr || !arr.length) return '-';
    return arr.map(s => `${DAYS[s.day]}요일 ${s.time}`).join(', ');
  }

  /* 아바타 색상 */
  const AVATAR_COLORS = [
    ['#F8E4F2','#C06898'], ['#DDE8F8','#4A88C8'], ['#D8F5EC','#3AAA7A'],
    ['#FEF5D0','#C8940A'], ['#EEE4FC','#6040A8'], ['#FCE8E8','#C84040']
  ];
  function avatarColor(name) {
    const i = (name || '?').charCodeAt(0) % AVATAR_COLORS.LENGTH || 0;
    return AVATAR_COLORS[i % AVATAR_COLORS.length];
  }
  function avatarHtml(name) {
    const [bg, color] = avatarColor(name);
    const ch = (name || '?').charAt(0);
    return `<div class="member-avatar" style="background:${bg};color:${color}">${ch}</div>`;
  }

  /* 토스트 */
  let _toastTimer = null;
  function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success:'check-circle', error:'exclamation-circle', warning:'exclamation-triangle', info:'info-circle' };
    el.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => el.classList.add('fade-out'), 2700);
    setTimeout(() => el.remove(), 3000);
  }

  /* 모달 */
  function openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }
  function confirm(msg, onOk) {
    openModal('확인',
      `<p class="confirm-msg">${msg}</p>`,
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">취소</button>
       <button class="btn btn-danger" id="__confirmOk">삭제</button>`
    );
    document.getElementById('__confirmOk').onclick = () => { closeModal(); onOk(); };
  }

  /* 달력 헬퍼 */
  function calDates(year, month) {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month+1, 0);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) {
      const d = new Date(year, month, -first.getDay()+i+1);
      cells.push({ date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, other: true });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ date: `${year}-${pad(month+1)}-${pad(d)}`, other: false });
    }
    while (cells.length % 7 !== 0) {
      const i = cells.length - (last.getDate() + first.getDay());
      const d = new Date(year, month+1, i+1);
      cells.push({ date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, other: true });
    }
    return cells;
  }

  return {
    uuid, todayStr, fmtDate, fmtDateKR, daysUntil, yearMonth, addMonths, getDow,
    fmtMoney, DAYS, DAYS_EN, AGE_MAP, PAY_MAP, METHOD_MAP,
    ageLabel, payLabel, methodLabel, payBadge, ageBadge,
    fmtSchedule, avatarColor, avatarHtml,
    toast, openModal, closeModal, confirm, calDates, pad
  };
})();
