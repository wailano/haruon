'use strict';

const FirebaseSync = (() => {
  const CONFIG = {
    apiKey: "AIzaSyAUiilXkrq7qv0zqmAmG0wy8pRLtn8CecI",
    authDomain: "haruon-eee4d.firebaseapp.com",
    projectId: "haruon-eee4d",
    storageBucket: "haruon-eee4d.firebasestorage.app",
    messagingSenderId: "164426709718",
    appId: "1:164426709718:web:0bf3ed8f0ae7a40a41e777"
  };

  const COL = {
    haruon_members:    'members',
    haruon_payments:   'payments',
    haruon_classes:    'classes',
    haruon_lessons:    'lessons',
    haruon_attendance: 'attendance'
  };
  const KEY = Object.fromEntries(Object.entries(COL).map(([k,v]) => [v,k]));

  let db = null;
  let _unsubscribers = [];
  let _onChangeCallback = null;

  /* ── 초기화 ─────────────────────── */
  function init() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(CONFIG);
      db = firebase.firestore();
      // 오프라인 지원 활성화
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch(e) {
      console.warn('[Firebase] 초기화 실패:', e);
      db = null;
    }
  }

  /* ── Firestore → localStorage 전체 로드 ─── */
  async function loadAll() {
    if (!db) return;
    try {
      await Promise.all(Object.values(COL).map(async col => {
        const snap = await db.collection(col).get();
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        localStorage.setItem(KEY[col], JSON.stringify(items));
      }));
    } catch(e) {
      console.warn('[Firebase] 데이터 로드 실패 (오프라인이거나 규칙 문제):', e.message);
    }
  }

  /* ── 단일 문서 쓰기 ─────────────── */
  function write(colName, id, data) {
    if (!db || !id) return;
    db.collection(colName).doc(String(id)).set(data)
      .catch(e => console.warn('[Firebase] 쓰기 실패:', e.message));
  }

  /* ── 단일 문서 삭제 ─────────────── */
  function remove(colName, id) {
    if (!db || !id) return;
    db.collection(colName).doc(String(id)).delete()
      .catch(e => console.warn('[Firebase] 삭제 실패:', e.message));
  }

  /* ── 실시간 리스너 (다른 기기 변경 감지) ─ */
  function startListeners(onChangeFn) {
    _onChangeCallback = onChangeFn;
    stopListeners();
    if (!db) return;

    Object.entries(COL).forEach(([lsKey, colName]) => {
      const unsub = db.collection(colName).onSnapshot(snap => {
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        localStorage.setItem(lsKey, JSON.stringify(items));
        if (_onChangeCallback) _onChangeCallback(colName);
      }, err => console.warn('[Firebase] 리스너 오류:', err.message));
      _unsubscribers.push(unsub);
    });
  }

  function stopListeners() {
    _unsubscribers.forEach(fn => fn());
    _unsubscribers = [];
  }

  /* localStorage 키 → Firestore 컬렉션명 변환 */
  function colOf(lsKey) { return COL[lsKey] || null; }

  return { init, loadAll, write, remove, startListeners, stopListeners, colOf };
})();
