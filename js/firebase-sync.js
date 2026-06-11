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
      // enablePersistence 비활성화 — IndexedDB 캐시가 stale 데이터를 복구하는 문제 방지
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
        // 첫 스냅샷은 loadAll()에서 이미 처리했으므로 스킵
        if (isFirst) { isFirst = false; return; }
        // 이후 스냅샷: 다른 기기에서 변경(추가/수정/삭제) 시 localStorage 동기화
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

  /* ── Firestore 전체 삭제 ─────────────── */
  async function clearFirestoreAll() {
    if (!db) {
      console.error('[Firebase] clearFirestoreAll: db가 초기화되지 않았음');
      return 0;
    }
    let totalDeleted = 0;
    const colNames = Object.values(COL);
    for (const col of colNames) {
      try {
        const snap = await db.collection(col).get();
        console.log(`[Firebase] ${col}: ${snap.size}개 문서 발견`);
        if (snap.size > 0) {
          // 500개 초과 시 분할 처리
          const CHUNK = 400;
          for (let i = 0; i < snap.docs.length; i += CHUNK) {
            const batch = db.batch();
            snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          totalDeleted += snap.size;
          console.log(`[Firebase] ${col}: ${snap.size}개 삭제 완료`);
        }
      } catch (e) {
        console.error(`[Firebase] ${col} 삭제 실패:`, e.code, e.message);
        throw e;
      }
    }
    console.log(`[Firebase] 전체 초기화 완료 — 총 ${totalDeleted}개 삭제`);
    return totalDeleted;
  }

  /* localStorage 키 → Firestore 컬렉션명 변환 */
  function colOf(lsKey) { return COL[lsKey] || null; }

  return { init, loadAll, write, remove, startListeners, stopListeners, colOf, clearFirestoreAll };
})();
