'use strict';

const DB = (() => {
  const K = {
    MEMBERS:    'haruon_members',
    PAYMENTS:   'haruon_payments',
    CLASSES:    'haruon_classes',
    LESSONS:    'haruon_lessons',
    ATTENDANCE: 'haruon_attendance'
  };

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  }
  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  function byId(key, id)        { return load(key).find(x => x.id === id) || null; }
  function add(key, item) {
    const a = load(key); a.push(item); save(key, a);
    if (window.FirebaseSync) FirebaseSync.write(FirebaseSync.colOf(key), item.id, item);
    return item;
  }
  function put(key, id, patch)  {
    const a = load(key);
    const i = a.findIndex(x => x.id === id);
    if (i < 0) return null;
    a[i] = { ...a[i], ...patch };
    save(key, a);
    if (window.FirebaseSync) FirebaseSync.write(FirebaseSync.colOf(key), id, a[i]);
    return a[i];
  }
  function del(key, id) {
    save(key, load(key).filter(x => x.id !== id));
    if (window.FirebaseSync) FirebaseSync.remove(FirebaseSync.colOf(key), id);
  }

  /* ─── 회원 ─────────────────────────────── */
  const members = {
    all:    ()     => load(K.MEMBERS),
    get:    id     => byId(K.MEMBERS, id),
    create: m      => add(K.MEMBERS, m),
    update: (id,p) => put(K.MEMBERS, id, p),
    delete: id     => del(K.MEMBERS, id),
    refreshStatus() {
      const now = new Date(); now.setHours(0,0,0,0);
      const list = load(K.MEMBERS).map(m => {
        if (!m.periodEnd) {
          // 수강 기간 없으면 미납 (단, 이미 만료된 경우 유지)
          if (m.paymentStatus !== 'expired') m.paymentStatus = 'unpaid';
          return m;
        }
        const end = new Date(m.periodEnd); end.setHours(0,0,0,0);
        const diff = Math.ceil((end - now) / 86400000);
        if (diff < 0)        m.paymentStatus = 'expired';
        else if (diff <= 7)  m.paymentStatus = 'expiring';
        // 기간이 남아있어도 수납 등록이 없으면 상태 그대로 유지
        // (완납은 수납 등록 시에만 설정됨)
        return m;
      });
      save(K.MEMBERS, list);
    }
  };

  /* ─── 수납 ─────────────────────────────── */
  const payments = {
    all:          ()   => load(K.PAYMENTS),
    get:          id   => byId(K.PAYMENTS, id),
    byMember:     mid  => load(K.PAYMENTS).filter(p => p.memberId === mid),
    create:       p    => add(K.PAYMENTS, p),
    update:       (id,patch) => put(K.PAYMENTS, id, patch),
    delete:       id   => del(K.PAYMENTS, id)
  };

  /* ─── 수업 ─────────────────────────────── */
  const classes = {
    all:    ()     => load(K.CLASSES),
    get:    id     => byId(K.CLASSES, id),
    create: c      => add(K.CLASSES, c),
    update: (id,p) => put(K.CLASSES, id, p),
    delete: id     => del(K.CLASSES, id)
  };

  /* ─── 수업 일지 ─────────────────────────── */
  const lessons = {
    all:       ()    => load(K.LESSONS),
    get:       id    => byId(K.LESSONS, id),
    byClass:   cid   => load(K.LESSONS).filter(l => l.classId === cid),
    create:    l     => add(K.LESSONS, l),
    update:    (id,p)=> put(K.LESSONS, id, p),
    delete:    id    => del(K.LESSONS, id)
  };

  /* ─── 출석 ─────────────────────────────── */
  const attendance = {
    all:       ()          => load(K.ATTENDANCE),
    get:       id          => byId(K.ATTENDANCE, id),
    byDate:    date        => load(K.ATTENDANCE).filter(a => a.date === date),
    byMember:  mid         => load(K.ATTENDANCE).filter(a => a.memberId === mid),
    byMonth:   ym          => load(K.ATTENDANCE).filter(a => a.date && a.date.startsWith(ym)),
    upsert(record) {
      const list = load(K.ATTENDANCE);
      const i = list.findIndex(a => a.date === record.date && a.memberId === record.memberId);
      if (i >= 0) {
        list[i] = { ...list[i], ...record }; save(K.ATTENDANCE, list);
        if (window.FirebaseSync) FirebaseSync.write('attendance', list[i].id, list[i]);
        return list[i];
      }
      list.push(record); save(K.ATTENDANCE, list);
      if (window.FirebaseSync) FirebaseSync.write('attendance', record.id, record);
      return record;
    },
    delete: id => del(K.ATTENDANCE, id)
  };

  /* ─── 전체 내보내기/가져오기 ──────────── */
  function exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      members:    load(K.MEMBERS),
      payments:   load(K.PAYMENTS),
      classes:    load(K.CLASSES),
      lessons:    load(K.LESSONS),
      attendance: load(K.ATTENDANCE)
    };
  }
  function importAll(data) {
    if (data.members)    save(K.MEMBERS,    data.members);
    if (data.payments)   save(K.PAYMENTS,   data.payments);
    if (data.classes)    save(K.CLASSES,    data.classes);
    if (data.lessons)    save(K.LESSONS,    data.lessons);
    if (data.attendance) save(K.ATTENDANCE, data.attendance);
  }
  function clearAll() { Object.values(K).forEach(k => localStorage.removeItem(k)); }

  return { members, payments, classes, lessons, attendance, exportAll, importAll, clearAll };
})();
