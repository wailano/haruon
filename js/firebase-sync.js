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

  /* ── Firestore ↔ localStorage 동기화 로드 ─── */
  async function loadAll() {
    if (!db) return;
    try {
      await Promise.all(Object.entries(COL).map(async ([lsKey, col]) => {
        const snap = await db.collection(col).get();

        if (snap.docs.length > 0) {
          // Firestore에 데이터 있음 → localStorage에 덮어씀
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          localStorage.setItem(lsKey, JSON.stringify(items));
        } else {
          // Firestore 비어있음 → localStorage 데이터를 Firestore에 업로드
          const local = JSON.parse(localStorage.getItem(lsKey) || '[]');
          if (local.length > 0) {
            const batch = db.batch();
            local.forEach(item => {
              if (item.id) batch.set(db.collection(col).doc(String(item.id)), item);
            });
            await batch.commit();
          }
          // localStorage는 건드리지 않음 (빈 데이터로 덮어쓰지 않음)
        }
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
      let isFirst = true;
      const unsub = db.collection(colName).onSnapshot(snap => {
        // 첫 스냅샷이 비어있으면 localStorage를 건드리지 않음 (loadAll에서 처리)
        if (isFirst && snap.docs.length === 0) { isFirst = false; return; }
        isFirst = false;
        if (snap.docs.length > 0) {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          localStorage.setItem(lsKey, JSON.stringify(items));
          if (_onChangeCallback) _onChangeCallback(colName);
        }
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
