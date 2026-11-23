// 미라클톡 4단계: 구글 로그인 + 친구 목록 + 1:1 채팅 + 단체방 + 전체 채팅방 + 프로필 아바타
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, addDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { AVATARS, findAvatar, avatarImagePath } from "./avatars.js";

// ---------- 화면 요소 ----------
const $ = (id) => document.getElementById(id);
const screens = {
  loading: $("loading-screen"),
  login: $("login-screen"),
  main: $("main-screen"),
  chat: $("chat-screen"),
};
const messagesEl = $("messages");
const inputEl = $("input");
const composerEl = $("composer");

function show(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle("hidden", key !== name);
  }
}

// ---------- 설정 확인 ----------
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("여기에")) {
  $("loading-text").innerHTML =
    "firebase-config.js에 Firebase 설정값을 아직 넣지 않았어요.<br>README.md의 1~2번을 먼저 해주세요.";
  throw new Error("Firebase 설정값 없음");
}

// ---------- Firebase 초기화 ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const LOBBY_ID = "lobby";

let currentUser = null;
let currentRoomId = null;          // 지금 열려 있는 방
let friends = [];                  // 친구 목록 캐시
let rooms = [];                    // 내 방 목록 캐시 (1:1 + 단체)
let roomsLoaded = false;
const unsub = { messages: null, rooms: null, friends: null };

function stopAll() {
  for (const k of Object.keys(unsub)) {
    if (unsub[k]) { unsub[k](); unsub[k] = null; }
  }
  stopProfiles();
}

// ========== 4단계: 프로필(아바타) 실시간 캐시 ==========
// 친구 목록·방 정보에 저장된 이름/사진은 '추가할 때' 찍어둔 값이라 오래될 수 있어요.
// 그래서 화면에 보이는 사람의 프로필(users/{uid})을 실시간으로 받아서 최신 아바타를 씁니다.
const profiles = new Map();      // uid -> { name, photo, avatar }
const profileUnsubs = new Map(); // uid -> 수신 끊기 함수

function watchProfile(uid) {
  if (!uid || !currentUser || profileUnsubs.has(uid)) return;
  const stop = onSnapshot(doc(db, "users", uid), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    const next = { name: d.name || "", photo: d.photo || "", avatar: d.avatar || "" };
    const old = profiles.get(uid);
    if (old && old.name === next.name && old.photo === next.photo && old.avatar === next.avatar) return;
    profiles.set(uid, next);
    scheduleRerender();
  }, (err) => console.warn("프로필을 받지 못했어요", uid, err.code));
  profileUnsubs.set(uid, stop);
}

function stopProfiles() {
  for (const stop of profileUnsubs.values()) stop();
  profileUnsubs.clear();
  profiles.clear();
}

// 이 사람을 화면에 그릴 때 쓸 정보 (최신 프로필 우선, 없으면 저장된 값)
function personInfo(uid, name, photo) {
  const p = profiles.get(uid);
  return {
    name: (p && p.name) || name || "",
    photo: (p && p.photo) || photo || "",
    avatar: (p && p.avatar) || "",
  };
}

// 프로필이 바뀌면 보이는 화면만 한 번에 다시 그림
let rerenderQueued = false;
function scheduleRerender() {
  if (rerenderQueued) return;
  rerenderQueued = true;
  requestAnimationFrame(() => {
    rerenderQueued = false;
    if (!currentUser) return;
    renderMyCard();
    renderFriends();
    if (roomsLoaded) renderRooms();
    if (currentRoomId && lastMsgs) render(lastMsgs);
    if (pickerOpen) renderPicker();
    if (avatarSheetOpen) renderAvatarSheet();
  });
}

// 두 사람의 1:1 방 ID는 항상 같게: uid 두 개를 정렬해서 붙임
function dmRoomId(a, b) {
  const [x, y] = [a, b].sort();
  return `dm_${x}_${y}`;
}

// ---------- 로그인 / 로그아웃 ----------
$("btn-login").addEventListener("click", async () => {
  $("login-error").textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // 팝업이 막힌 환경(일부 모바일)에서는 리다이렉트로 재시도
    if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
    console.error(err);
    $("login-error").textContent = loginErrorMessage(err.code);
  }
});

function loginErrorMessage(code) {
  if (code === "auth/unauthorized-domain") {
    return "이 주소가 Firebase 승인된 도메인에 없어요. README 7번을 확인해주세요.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Firebase에서 Google 로그인이 꺼져 있어요. README 3번을 확인해주세요.";
  }
  return `로그인에 실패했어요 (${code})`;
}

$("btn-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  stopAll();
  if (pickerOpen) { pickerOpen = false; $("picker").classList.add("hidden"); }
  if (avatarSheetOpen) { avatarSheetOpen = false; $("avatar-sheet").classList.add("hidden"); }
  currentRoomId = null;
  lastMsgs = null;
  friends = [];
  rooms = [];
  roomsLoaded = false;

  if (!user) {
    messagesEl.innerHTML = "";
    show("login");
    return;
  }

  $("me-name").textContent = user.displayName || "나";
  renderMyCard();

  // 프로필 저장: 이메일까지 저장해야 친구가 나를 이메일로 찾을 수 있음
  try {
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName || "이름없음",
      photo: user.photoURL || "",
      email: (user.email || "").toLowerCase(),
      lastLogin: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error("프로필 저장 실패", e);
  }

  watchProfile(user.uid); // 내 아바타
  subscribeFriends();
  subscribeRooms();
  switchTab("chats");
  show("main");
});

// ---------- 공통: 아바타 만들기 ----------
const brokenImages = new Set(); // 불러오기 실패한 아바타 그림 (다시 시도 안 함)

// 고른 아바타(id) → 라이라 그림이 들어간 동그라미
// (그림을 못 불러오면 직업 이름 첫 글자로 대신 표시)
function fillCharacter(el, a) {
  el.classList.add("char");
  el.title = a.label;
  const fallback = () => {
    el.innerHTML = "";
    el.textContent = a.label.slice(0, 1);
  };
  if (brokenImages.has(a.id)) { fallback(); return; }
  const img = document.createElement("img");
  img.src = avatarImagePath(a);
  img.alt = "";
  img.decoding = "async";
  img.onerror = () => { brokenImages.add(a.id); fallback(); };
  el.appendChild(img);
}

function makeAvatar(name, photo, avatarId) {
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  const ch = findAvatar(avatarId);
  if (ch) {
    fillCharacter(avatar, ch);
  } else if (photo) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    avatar.appendChild(img);
  } else {
    avatar.textContent = (name || "?").slice(0, 1);
  }
  return avatar;
}

// uid로 최신 프로필을 찾아서 아바타 만들기
function makeAvatarFor(uid, name, photo) {
  watchProfile(uid);
  const p = personInfo(uid, name, photo);
  return makeAvatar(p.name, p.photo, p.avatar);
}

// 목록에 쓰는 한 줄 (아바타 + 이름 + 부가설명 + 오른쪽 정보)
function makeListItem({ name, photo, sub, right, avatarEl, uid }) {
  const li = document.createElement("li");
  li.className = "list-item";
  li.tabIndex = 0;

  li.appendChild(avatarEl || (uid ? makeAvatarFor(uid, name, photo) : makeAvatar(name, photo)));

  const text = document.createElement("div");
  text.className = "list-text";
  const n = document.createElement("div");
  n.className = "list-name";
  n.textContent = name;
  text.appendChild(n);
  if (sub) {
    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = sub;
    text.appendChild(s);
  }
  li.appendChild(text);

  if (right) li.appendChild(right);
  return li;
}

function onActivate(el, fn) {
  el.addEventListener("click", fn);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  });
}

// ---------- 탭 ----------
const tabTitles = { friends: "친구", chats: "채팅" };

function switchTab(name) {
  $("tab-friends").classList.toggle("hidden", name !== "friends");
  $("tab-chats").classList.toggle("hidden", name !== "chats");
  $("main-title").textContent = tabTitles[name];
  for (const btn of document.querySelectorAll(".tab")) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
}

for (const btn of document.querySelectorAll(".tab")) {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
}

// ---------- 친구 탭 ----------
function renderMyCard() {
  // 맨 위 내 이름 옆 작은 아바타 (누르면 아바타 고르기)
  const meAv = $("me-avatar");
  meAv.innerHTML = "";
  meAv.appendChild(makeAvatarFor(currentUser.uid, currentUser.displayName, currentUser.photoURL));

  const card = $("my-card");
  card.innerHTML = "";
  card.appendChild(makeAvatarFor(currentUser.uid, currentUser.displayName, currentUser.photoURL));
  const text = document.createElement("div");
  text.className = "list-text";
  const n = document.createElement("div");
  n.className = "list-name";
  n.textContent = currentUser.displayName || "나";
  const s = document.createElement("div");
  s.className = "list-sub";
  s.textContent = `내 이메일: ${currentUser.email || ""}`;
  text.append(n, s);
  card.appendChild(text);

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "btn-ghost small";
  edit.textContent = "아바타";
  edit.addEventListener("click", (e) => { e.stopPropagation(); openAvatarSheet(); });
  card.appendChild(edit);
}

function subscribeFriends() {
  unsub.friends = onSnapshot(collection(db, "users", currentUser.uid, "friends"), (snap) => {
    friends = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    friends.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
    renderFriends();
    if (roomsLoaded) renderRooms(); // 방 목록의 이름/사진도 최신 친구 정보로
  }, (err) => {
    console.error(err);
    setFriendMsg(err.code === "permission-denied"
      ? "친구 목록을 읽을 권한이 없어요. 보안 규칙을 새로 게시했는지 확인해주세요."
      : `친구 목록을 불러오지 못했어요 (${err.code})`, true);
  });
}

function renderFriends() {
  const list = $("friend-list");
  list.innerHTML = "";
  $("friend-count").textContent = friends.length;

  if (friends.length === 0) {
    const p = document.createElement("li");
    p.className = "empty";
    p.textContent = "아직 친구가 없어요. 위에 친구의 구글 이메일을 넣어보세요.";
    list.appendChild(p);
    return;
  }

  for (const f of friends) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-ghost small";
    del.textContent = "삭제";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`${f.name}님을 친구 목록에서 삭제할까요?\n(대화방은 그대로 남아요)`)) return;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "friends", f.uid));
      } catch (err) {
        console.error(err);
        alert(`삭제하지 못했어요 (${err.code})`);
      }
    });

    const li = makeListItem({ uid: f.uid, name: personInfo(f.uid, f.name).name, photo: f.photo, sub: f.email, right: del });
    onActivate(li, () => openDM(f));
    list.appendChild(li);
  }
}

function setFriendMsg(text, isError = false) {
  const el = $("friend-msg");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

$("add-friend").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("friend-email").value.trim().toLowerCase();
  if (!email) return;

  if (email === (currentUser.email || "").toLowerCase()) {
    setFriendMsg("내 이메일이에요. 친구의 이메일을 넣어주세요.", true);
    return;
  }

  const btn = $("btn-add-friend");
  btn.disabled = true;
  setFriendMsg("찾는 중...");

  try {
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", email), limit(1)));
    if (snap.empty) {
      setFriendMsg("미라클톡에 한 번이라도 로그인한 사람만 추가할 수 있어요. 친구에게 먼저 로그인해달라고 해주세요.", true);
      return;
    }
    const found = snap.docs[0];
    if (friends.some((f) => f.uid === found.id)) {
      setFriendMsg(`${found.data().name}님은 이미 친구예요.`);
      return;
    }
    const data = found.data();
    await setDoc(doc(db, "users", currentUser.uid, "friends", found.id), {
      name: data.name || "이름없음",
      photo: data.photo || "",
      email: data.email || email,
      addedAt: serverTimestamp(),
    });
    $("friend-email").value = "";
    setFriendMsg(`${data.name}님을 친구로 추가했어요.`);
  } catch (err) {
    console.error(err);
    setFriendMsg(err.code === "permission-denied"
      ? "권한 오류예요. 보안 규칙을 새로 게시했는지 확인해주세요."
      : `추가하지 못했어요 (${err.code})`, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- 채팅 탭 (방 목록) ----------
function subscribeRooms() {
  // 정렬은 화면에서 처리 → Firestore 복합 색인을 따로 만들 필요 없음
  const q = query(collection(db, "rooms"), where("members", "array-contains", currentUser.uid));
  unsub.rooms = onSnapshot(q, (snap) => {
    rooms = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    rooms.sort((a, b) => toDate(b.updatedAt) - toDate(a.updatedAt));
    roomsLoaded = true;
    renderRooms();
    syncOpenRoom();
  }, (err) => {
    console.error(err);
    const list = $("room-list");
    list.innerHTML = "";
    const p = document.createElement("li");
    p.className = "empty error";
    p.textContent = err.code === "permission-denied"
      ? "대화방 목록을 읽을 권한이 없어요. 보안 규칙을 새로 게시했는지 확인해주세요."
      : `대화방 목록을 불러오지 못했어요 (${err.code})`;
    list.appendChild(p);
  });
}

function otherMember(room) {
  const otherUid = room.members.find((u) => u !== currentUser.uid);
  const info = (room.memberInfo && room.memberInfo[otherUid]) || {};
  // 친구 목록에 있으면 그쪽 정보가 더 최신
  const f = friends.find((x) => x.uid === otherUid);
  const p = personInfo(otherUid, (f && f.name) || info.name, (f && f.photo) || info.photo);
  return {
    uid: otherUid,
    name: p.name || "알 수 없음",
    photo: p.photo,
  };
}

// 방 이름: 1:1은 상대 이름, 단체방은 방 이름
function roomName(room) {
  if (!room) return "채팅방";
  return room.type === "group" ? (room.name || "단체방") : otherMember(room).name;
}

function roomTitle(room) {
  if (room && room.type === "group") return `${roomName(room)} (${room.members.length})`;
  return roomName(room);
}

function groupAvatar(room) {
  const el = document.createElement("div");
  el.className = "avatar group";
  el.textContent = (room.name || "단").slice(0, 1);
  return el;
}

function renderRooms() {
  const list = $("room-list");
  list.innerHTML = "";

  // 전체 채팅방은 맨 위 고정
  const lobbyAvatar = document.createElement("div");
  lobbyAvatar.className = "avatar lobby";
  lobbyAvatar.textContent = "전체";
  const lobby = makeListItem({ name: "전체 채팅방", sub: "모두가 함께 쓰는 방", avatarEl: lobbyAvatar });
  onActivate(lobby, () => openRoom(LOBBY_ID, "전체 채팅방"));
  list.appendChild(lobby);

  for (const room of rooms) {
    const isGroup = room.type === "group";
    const time = document.createElement("span");
    time.className = "list-time";
    time.textContent = room.lastMessage ? shortTime(toDate(room.updatedAt)) : "";

    let preview = isGroup ? "새 단체방이에요" : "아직 대화가 없어요";
    const lm = room.lastMessage;
    if (lm) {
      let who = "";
      if (lm.system) who = "";
      else if (lm.uid === currentUser.uid) who = "나: ";
      else if (isGroup && lm.name) who = `${lm.name}: `;
      preview = who + lm.text;
    }

    let li;
    if (isGroup) {
      li = makeListItem({ name: room.name || "단체방", sub: preview, right: time, avatarEl: groupAvatar(room) });
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = room.members.length;
      li.querySelector(".list-name").appendChild(count);
    } else {
      const other = otherMember(room);
      li = makeListItem({ uid: other.uid, name: other.name, photo: other.photo, sub: preview, right: time });
    }
    onActivate(li, () => openRoom(room.id));
    list.appendChild(li);
  }

  if (rooms.length === 0) {
    const p = document.createElement("li");
    p.className = "empty";
    p.textContent = "친구 탭에서 친구를 누르면 1:1 대화가, 위의 '+ 새 단체방'으로 단체 대화가 시작돼요.";
    list.appendChild(p);
  }
}

// ---------- 1:1 방 열기 (없으면 만들기) ----------
async function openDM(friend) {
  const roomId = dmRoomId(currentUser.uid, friend.uid);
  const roomRef = doc(db, "rooms", roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      const members = [currentUser.uid, friend.uid].sort();
      await setDoc(roomRef, {
        type: "dm",
        members,
        memberInfo: {
          [currentUser.uid]: { name: currentUser.displayName || "이름없음", photo: currentUser.photoURL || "" },
          [friend.uid]: { name: friend.name || "이름없음", photo: friend.photo || "" },
        },
        lastMessage: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // 상대가 같은 순간에 방을 먼저 만든 경우: 이미 있으면 그냥 들어감
    const again = await getDoc(roomRef).catch(() => null);
    if (!again || !again.exists()) {
      console.error(err);
      alert(err.code === "permission-denied"
        ? "대화방을 만들 권한이 없어요. 보안 규칙을 새로 게시했는지, 친구가 다시 로그인했는지 확인해주세요."
        : `대화방을 열지 못했어요 (${err.code})`);
      return;
    }
  }

  openRoom(roomId, friend.name);
}

// ---------- 대화 화면 ----------
function findRoom(roomId) {
  return rooms.find((r) => r.id === roomId) || null;
}

let openRoomSeen = false; // 열린 방이 내 방 목록에 한 번이라도 보였는지
let lastMsgs = null;       // 마지막으로 그린 메시지 (아바타가 바뀌면 다시 그리기용)

function updateRoomHeader() {
  const room = findRoom(currentRoomId);
  const isGroup = room && room.type === "group";
  if (room) $("room-title").textContent = roomTitle(room);
  $("btn-invite").classList.toggle("hidden", !isGroup);
  $("btn-leave").classList.toggle("hidden", !isGroup);
  $("room-me").textContent = currentUser ? `나: ${currentUser.displayName || "나"}` : "";
}

// 방 목록이 바뀔 때: 열린 방 제목(인원수) 갱신, 내가 빠진 방이면 닫기
function syncOpenRoom() {
  if (!currentRoomId || currentRoomId === LOBBY_ID) return;
  const room = findRoom(currentRoomId);
  if (room) {
    openRoomSeen = true;
    updateRoomHeader();
  } else if (openRoomSeen) {
    leaveChatScreen();
  }
}

function openRoom(roomId, title, opts = {}) {
  if (unsub.messages) { unsub.messages(); unsub.messages = null; }
  currentRoomId = roomId;
  lastMsgs = null;
  openRoomSeen = !!findRoom(roomId);
  $("room-title").textContent = title || roomTitle(findRoom(roomId));
  updateRoomHeader();
  messagesEl.innerHTML = "";
  inputEl.value = "";
  show("chat");
  autoGrow(); // 화면이 보인 다음에 높이 계산 (숨겨진 상태에서 재면 0이 됨)
  // 폰의 뒤로가기 버튼으로 방에서 나올 수 있게
  if (opts.replace) history.replaceState({ room: roomId }, "");
  else history.pushState({ room: roomId }, "");
  subscribeMessages(roomId);
  inputEl.focus();
}

function closeRoom() {
  leavingRoom = false;
  if (unsub.messages) { unsub.messages(); unsub.messages = null; }
  currentRoomId = null;
  lastMsgs = null;
  messagesEl.innerHTML = "";
  if (currentUser) show("main");
}

// 대화 화면에서 목록으로 (브라우저 기록도 같이 정리)
let leavingRoom = false; // 두 번 뒤로 가는 것 방지
function leaveChatScreen() {
  if (leavingRoom) return;
  if (history.state && history.state.room) {
    leavingRoom = true;
    history.back(); // popstate에서 closeRoom 실행
  } else closeRoom();
}

$("btn-back").addEventListener("click", leaveChatScreen);

window.addEventListener("popstate", () => {
  if (skipNextPop) { skipNextPop = false; return; }
  if (avatarSheetOpen) { closeAvatarSheet(false); return; }
  if (pickerOpen) { closePicker(false); return; }
  if (currentRoomId) closeRoom();
});

// ---------- 실시간 메시지 수신 ----------
function subscribeMessages(roomId) {
  const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "desc"), limit(100));
  unsub.messages = onSnapshot(q, (snap) => {
    if (roomId !== currentRoomId) return;
    const msgs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data({ serverTimestamps: "estimate" }),
      pending: d.metadata.hasPendingWrites,
    })).reverse();
    lastMsgs = msgs;
    render(msgs);
  }, (err) => {
    console.error(err);
    messagesEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "system";
    p.textContent = err.code === "permission-denied"
      ? "이 방의 메시지를 읽을 권한이 없어요. 보안 규칙을 확인해주세요."
      : `메시지를 불러오지 못했어요 (${err.code})`;
    messagesEl.appendChild(p);
  });
}

// ---------- 시간 표시 ----------
const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const monthDayFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
const fullDateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });

function toDate(ts) {
  return ts && typeof ts.toDate === "function" ? ts.toDate() : new Date();
}

// 방 목록용: 오늘이면 시간, 어제면 '어제', 올해면 '11월 22일', 그 전이면 '2025. 11. 22.'
function shortTime(date) {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeFmt.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "어제";
  if (date.getFullYear() === now.getFullYear()) return monthDayFmt.format(date);
  return fullDateFmt.format(date);
}

// ---------- 메시지 그리기 ----------
function render(msgs) {
  const nearBottom =
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  const lastIsMine = msgs.length && msgs[msgs.length - 1].uid === currentUser?.uid;

  messagesEl.innerHTML = "";

  if (msgs.length === 0) {
    const p = document.createElement("p");
    p.className = "system";
    p.textContent = "아직 대화가 없어요. 첫 메시지를 남겨보세요.";
    messagesEl.appendChild(p);
    return;
  }

  let prevDateKey = "";
  let prev = null;

  for (const m of msgs) {
    const date = toDate(m.createdAt);
    const dateKey = date.toDateString();

    // 날짜 구분선
    if (dateKey !== prevDateKey) {
      const divider = document.createElement("div");
      divider.className = "date-divider";
      divider.textContent = dateFmt.format(date);
      messagesEl.appendChild(divider);
      prevDateKey = dateKey;
      prev = null;
    }

    // 안내 메시지: 가운데 작게
    if (m.system) {
      const sys = document.createElement("div");
      sys.className = "system-msg";
      sys.textContent = m.text;
      messagesEl.appendChild(sys);
      prev = null;
      continue;
    }

    const mine = m.uid === currentUser.uid;
    // 같은 사람이 1분 안에 연달아 보낸 메시지는 이름/사진 생략
    const grouped = prev && prev.uid === m.uid &&
      Math.abs(date - toDate(prev.createdAt)) < 60_000;

    const row = document.createElement("div");
    row.className = `msg-row ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""}`;

    if (!mine) {
      const avatar = grouped ? document.createElement("div") : makeAvatarFor(m.uid, m.name, m.photo);
      avatar.className = "avatar";
      row.appendChild(avatar);
    }

    const body = document.createElement("div");
    body.className = "msg-body";

    if (!mine && !grouped) {
      const name = document.createElement("div");
      name.className = "msg-name";
      name.textContent = m.name || "이름없음";
      body.appendChild(name);
    }

    const line = document.createElement("div");
    line.className = "msg-line";

    const bubble = document.createElement("div");
    bubble.className = "bubble" + (m.pending ? " pending" : "");
    bubble.textContent = m.text; // textContent 사용: 스크립트 주입 방지

    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = m.pending ? "전송 중" : timeFmt.format(date);

    line.append(bubble, time);
    body.appendChild(line);
    row.appendChild(body);
    messagesEl.appendChild(row);

    prev = m;
  }

  if (nearBottom || lastIsMine) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// ---------- 메시지 보내기 ----------
async function sendMessage() {
  const text = inputEl.value.trim();
  const roomId = currentRoomId;
  if (!text || !currentUser || !roomId) return;

  inputEl.value = "";
  autoGrow();

  const message = {
    uid: currentUser.uid,
    name: myName(),
    photo: currentUser.photoURL || "",
    text,
    createdAt: serverTimestamp(),
  };

  try {
    if (roomId === LOBBY_ID) {
      await addDoc(collection(db, "rooms", LOBBY_ID, "messages"), message);
    } else {
      // 메시지 저장 + 방 목록의 '마지막 메시지' 갱신을 한 번에 (둘 다 되거나 둘 다 안 되거나)
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "rooms", roomId, "messages")), message);
      batch.update(doc(db, "rooms", roomId), {
        lastMessage: { text: text.slice(0, 100), uid: currentUser.uid, name: myName() },
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (err) {
    console.error(err);
    if (currentRoomId === roomId) {
      inputEl.value = text; // 실패하면 입력 내용 복구
      autoGrow();
    }
    alert(err.code === "permission-denied"
      ? "전송 권한이 없어요. 보안 규칙을 확인해주세요."
      : `전송에 실패했어요 (${err.code})`);
  }
}

composerEl.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
  inputEl.focus();
});

// Enter = 전송, Shift+Enter = 줄바꿈
// isComposing 체크: 한글 입력 중 Enter가 두 번 전송되는 문제 방지
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    sendMessage();
  }
});

function autoGrow() {
  inputEl.style.height = "auto";
  if (!inputEl.scrollHeight) return; // 화면이 숨겨져 있으면 건너뜀
  // border-box라서 위아래 테두리 2px를 더해야 글자가 안 잘림
  inputEl.style.height = Math.min(inputEl.scrollHeight + 2, 140) + "px";
}
inputEl.addEventListener("input", autoGrow);

// ========== 3단계: 단체방 ==========
function myName() {
  return (currentUser && currentUser.displayName) || "이름없음";
}

function myInfo() {
  return { name: myName(), photo: currentUser.photoURL || "" };
}

// 이름 목록을 "가, 나, 다 외 2명"처럼 짧게
function joinNames(names, max = 3) {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} 외 ${names.length - max}명`;
}

// ---------- 친구 고르기 창 ----------
let pickerOpen = false;
let pickerMode = "create";     // "create" = 새 단체방, "invite" = 초대
let pickerSelected = new Set();
let pickerExisting = new Set(); // 초대할 때 이미 방에 있는 사람
let skipNextPop = false;

function openPicker(mode, existingMembers = []) {
  pickerMode = mode;
  pickerSelected = new Set();
  pickerExisting = new Set(existingMembers);
  $("picker-title").textContent = mode === "create" ? "새 단체방" : "친구 초대";
  $("picker-name-wrap").classList.toggle("hidden", mode !== "create");
  $("picker-name").value = "";
  $("picker-msg").textContent = "";
  $("picker-msg").classList.remove("error");
  renderPicker();
  $("picker").classList.remove("hidden");
  pickerOpen = true;
  history.pushState({ picker: true, room: currentRoomId }, "");
}

// viaHistory: 직접 닫을 때 true (브라우저 기록도 한 칸 되돌림)
function closePicker(viaHistory = true) {
  if (!pickerOpen) return;
  pickerOpen = false;
  $("picker").classList.add("hidden");
  if (viaHistory && history.state && history.state.picker) {
    skipNextPop = true;
    history.back();
  }
}

function renderPicker() {
  const list = $("picker-list");
  list.innerHTML = "";

  if (friends.length === 0) {
    const p = document.createElement("li");
    p.className = "empty";
    p.textContent = "먼저 친구 탭에서 친구를 추가해주세요.";
    list.appendChild(p);
  }

  for (const f of friends) {
    const already = pickerExisting.has(f.uid);
    const check = document.createElement("span");
    check.className = "check";
    check.textContent = "✓";
    const li = makeListItem({
      uid: f.uid, name: personInfo(f.uid, f.name).name, photo: f.photo,
      sub: already ? "이미 참여 중" : f.email,
      right: already ? null : check,
    });
    if (already) {
      li.classList.add("disabled");
      li.tabIndex = -1;
    } else {
      li.classList.toggle("selected", pickerSelected.has(f.uid));
      li.setAttribute("role", "checkbox");
      li.setAttribute("aria-checked", String(pickerSelected.has(f.uid)));
      onActivate(li, () => {
        if (pickerSelected.has(f.uid)) pickerSelected.delete(f.uid);
        else pickerSelected.add(f.uid);
        renderPicker();
      });
    }
    list.appendChild(li);
  }

  const n = pickerSelected.size;
  $("picker-count").textContent = n ? `${n}명 선택` : "";
  const ok = $("picker-ok");
  ok.disabled = n === 0;
  ok.textContent = pickerMode === "create"
    ? (n ? `${n}명과 단체방 만들기` : "만들기")
    : (n ? `${n}명 초대하기` : "초대하기");
}

function setPickerMsg(text, isError = false) {
  $("picker-msg").textContent = text;
  $("picker-msg").classList.toggle("error", isError);
}

$("picker-close").addEventListener("click", () => closePicker());
$("btn-new-group").addEventListener("click", () => openPicker("create"));

$("picker-ok").addEventListener("click", async () => {
  const picked = friends.filter((f) => pickerSelected.has(f.uid));
  if (picked.length === 0) return;
  const btn = $("picker-ok");
  btn.disabled = true;
  setPickerMsg(pickerMode === "create" ? "만드는 중..." : "초대하는 중...");
  try {
    if (pickerMode === "create") await createGroup(picked);
    else await inviteToGroup(picked);
  } catch (err) {
    console.error(err);
    setPickerMsg(err.code === "permission-denied"
      ? "권한 오류예요. 보안 규칙을 3단계용으로 새로 게시했는지 확인해주세요."
      : `실패했어요 (${err.code || err.message})`, true);
    btn.disabled = false;
  }
});

// ---------- 단체방 만들기 ----------
async function createGroup(picked) {
  if (picked.length + 1 > 50) throw new Error("단체방은 최대 50명까지예요");
  let name = $("picker-name").value.trim();
  if (!name) name = joinNames([myName(), ...picked.map((f) => f.name)]);
  name = name.slice(0, 30);

  const members = [currentUser.uid, ...picked.map((f) => f.uid)];
  const memberInfo = { [currentUser.uid]: myInfo() };
  for (const f of picked) memberInfo[f.uid] = { name: f.name || "이름없음", photo: f.photo || "" };

  const ref = doc(collection(db, "rooms"));
  await setDoc(ref, {
    type: "group",
    name,
    members,
    memberInfo,
    createdBy: currentUser.uid,
    lastMessage: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 친구 고르기 창 기록을 방 기록으로 바꿔치기 → 뒤로가기 한 번에 목록으로
  pickerOpen = false;
  $("picker").classList.add("hidden");
  openRoom(ref.id, `${name} (${members.length})`, { replace: true });
}

// ---------- 초대하기 ----------
$("btn-invite").addEventListener("click", async () => {
  const room = findRoom(currentRoomId);
  if (!room || room.type !== "group") return;
  openPicker("invite", room.members);
});

async function inviteToGroup(picked) {
  const roomId = currentRoomId;
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = snap.data();

  const added = picked.filter((f) => !room.members.includes(f.uid));
  if (added.length === 0) { closePicker(); return; }
  if (room.members.length + added.length > 50) throw new Error("단체방은 최대 50명까지예요");

  const text = `${myName()}님이 ${joinNames(added.map((f) => f.name || "이름없음"), 5)}님을 초대했습니다.`.slice(0, 300);
  const update = {
    members: arrayUnion(...added.map((f) => f.uid)),
    lastMessage: { text: text.slice(0, 100), uid: currentUser.uid, system: true },
    updatedAt: serverTimestamp(),
  };
  for (const f of added) {
    update[`memberInfo.${f.uid}`] = { name: f.name || "이름없음", photo: f.photo || "" };
  }

  const batch = writeBatch(db);
  batch.set(doc(collection(db, "rooms", roomId, "messages")), systemMessage(text));
  batch.update(roomRef, update);
  await batch.commit();
  closePicker();
}

function systemMessage(text) {
  return {
    uid: currentUser.uid,
    name: myName(),
    photo: currentUser.photoURL || "",
    text,
    system: true,
    createdAt: serverTimestamp(),
  };
}

// ---------- 나가기 ----------
$("btn-leave").addEventListener("click", async () => {
  const room = findRoom(currentRoomId);
  if (!room || room.type !== "group") return;
  if (!confirm(`'${room.name}' 방에서 나갈까요?\n나가면 대화 내용을 더 이상 볼 수 없고, 다시 들어오려면 초대를 받아야 해요.`)) return;

  const roomId = currentRoomId;
  const text = `${myName()}님이 나갔습니다.`.slice(0, 300);
  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "rooms", roomId, "messages")), systemMessage(text));
    batch.update(doc(db, "rooms", roomId), {
      members: arrayRemove(currentUser.uid),
      lastMessage: { text: text.slice(0, 100), uid: currentUser.uid, system: true },
      updatedAt: serverTimestamp(),
    });
    // 나간 뒤에는 읽기 권한이 없어지므로 먼저 수신을 끊어둠
    if (unsub.messages) { unsub.messages(); unsub.messages = null; }
    await batch.commit();
    if (currentRoomId === roomId) leaveChatScreen();
  } catch (err) {
    console.error(err);
    if (currentRoomId === roomId && !unsub.messages) subscribeMessages(roomId);
    alert(err.code === "permission-denied"
      ? "나가기 권한이 없어요. 보안 규칙을 3단계용으로 새로 게시했는지 확인해주세요."
      : `나가지 못했어요 (${err.code})`);
  }
});

// ========== 4단계: 아바타 고르기 창 ==========
let avatarSheetOpen = false;
let avatarChoice = "";   // 고르는 중인 아바타 id ("" = 구글 사진)

function myAvatarId() {
  const p = profiles.get(currentUser.uid);
  return (p && p.avatar) || "";
}

function openAvatarSheet() {
  avatarChoice = myAvatarId();
  $("avatar-msg").textContent = "";
  $("avatar-msg").classList.remove("error");
  renderAvatarSheet();
  $("avatar-sheet").classList.remove("hidden");
  avatarSheetOpen = true;
  history.pushState({ sheet: "avatar", room: currentRoomId }, "");
}

function closeAvatarSheet(viaHistory = true) {
  if (!avatarSheetOpen) return;
  avatarSheetOpen = false;
  $("avatar-sheet").classList.add("hidden");
  if (viaHistory && history.state && history.state.sheet === "avatar") {
    skipNextPop = true;
    history.back();
  }
}

function avatarOption(id, label, avatarEl) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "avatar-option" + (avatarChoice === id ? " selected" : "");
  btn.setAttribute("aria-pressed", String(avatarChoice === id));
  btn.appendChild(avatarEl);
  const cap = document.createElement("span");
  cap.className = "avatar-label";
  cap.textContent = label;
  btn.appendChild(cap);
  btn.addEventListener("click", () => {
    avatarChoice = id;
    renderAvatarSheet();
  });
  return btn;
}

function renderAvatarSheet() {
  // 맨 위 미리보기
  const preview = $("avatar-preview");
  preview.innerHTML = "";
  const big = makeAvatar(currentUser.displayName, currentUser.photoURL, avatarChoice);
  big.classList.add("big");
  preview.appendChild(big);

  const grid = $("avatar-grid");
  grid.innerHTML = "";
  // 첫 칸: 원래 구글 사진 (아바타 안 씀)
  grid.appendChild(avatarOption("", "구글 사진", makeAvatar(currentUser.displayName, currentUser.photoURL)));
  for (const a of AVATARS) {
    grid.appendChild(avatarOption(a.id, a.label, makeAvatar(a.label, "", a.id)));
  }

  const ok = $("avatar-ok");
  ok.disabled = avatarChoice === myAvatarId();
}

$("avatar-close").addEventListener("click", () => closeAvatarSheet());
$("me-avatar").addEventListener("click", openAvatarSheet);
// 내 프로필 카드(친구 탭)나 맨 위 내 이름을 눌러도 아바타 고르기
onActivate($("my-card"), () => { if (currentUser) openAvatarSheet(); });
onActivate($("me-name"), () => { if (currentUser) openAvatarSheet(); });

$("avatar-ok").addEventListener("click", async () => {
  const btn = $("avatar-ok");
  btn.disabled = true;
  $("avatar-msg").textContent = "저장하는 중...";
  $("avatar-msg").classList.remove("error");
  try {
    await setDoc(doc(db, "users", currentUser.uid), { avatar: avatarChoice }, { merge: true });
    closeAvatarSheet();
  } catch (err) {
    console.error(err);
    $("avatar-msg").textContent = err.code === "permission-denied"
      ? "권한 오류예요. 보안 규칙을 4단계용으로 새로 게시했는지 확인해주세요."
      : `저장하지 못했어요 (${err.code})`;
    $("avatar-msg").classList.add("error");
    btn.disabled = false;
  }
});

// ---------- PWA 서비스워커 ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW 등록 실패", e));
}
