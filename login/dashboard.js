import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

/* ------------------------------
   FIREBASE CONFIG
--------------------------------*/
const firebaseConfig = {
  apiKey: "AIzaSyCW0rdId5Qm7pBPx9x38WokCl_--RzlSqU",
  authDomain: "notts-masters-dashboard.firebaseapp.com",
  projectId: "notts-masters-dashboard",
  storageBucket: "notts-masters-dashboard.firebasestorage.app",
  messagingSenderId: "346400528175",
  appId: "1:346400528175:web:4896b4899aa965b752f3da",
  measurementId: "G-5WR5NWQ6BK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ------------------------------
   BACKEND URL
--------------------------------*/
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzVyybiZpUBjJ1MidS8ZFk-XgPfFlm2rZuAWAXBW99wxgNURZLCuxxRS6IR5lq5zLhN4w/exec";

/* ------------------------------
   DOM ELEMENTS
--------------------------------*/
const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");
const loginEmailInput = document.getElementById("login-email");
const sendLinkBtn = document.getElementById("send-link-btn");
const loginMessage = document.getElementById("login-message");
const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout-btn");

const ageGroupSelect = document.getElementById("age-group");
const startInput = document.getElementById("start-datetime");
const endInput = document.getElementById("end-datetime");
const addEntryBtn = document.getElementById("add-entry-btn");
const formMessage = document.getElementById("form-message");

const playerTableBody = document.querySelector("#player-table tbody");
const captainControls = document.getElementById("captain-controls");
const captainTableWrapper = document.getElementById("captain-table-wrapper");
const captainTableBody = document.querySelector("#captain-table tbody");
const captainAgeFilter = document.getElementById("captain-age-filter");
const refreshAllBtn = document.getElementById("refresh-all-btn");
const roleBanner = document.getElementById("role-banner");

let currentProfile = null;

/* ------------------------------
   MAGIC LINK LOGIN
--------------------------------*/
const actionCodeSettings = {
  url: "https://nottsmastersbadminton.github.io/PlayersDashboard/",
  handleCodeInApp: true
};

sendLinkBtn.addEventListener("click", async () => {
  const email = loginEmailInput.value.trim();
  if (!email) {
    loginMessage.textContent = "Please enter your email.";
    return;
  }
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    loginMessage.textContent = "Sign-in link sent. Check your email.";
  } catch (err) {
    loginMessage.textContent = "Error sending link.";
  }
});

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = window.localStorage.getItem("emailForSignIn");
  if (!email) email = window.prompt("Confirm your email");
  signInWithEmailLink(auth, email, window.location.href)
    .then(() => window.localStorage.removeItem("emailForSignIn"))
    .catch(() => (loginMessage.textContent = "Sign-in error."));
}

/* ------------------------------
   AUTH STATE
--------------------------------*/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  // Fetch profile from backend
  const res = await fetch(
    `${SCRIPT_URL}?action=getProfile&email=${encodeURIComponent(user.email)}`
  );
  const profile = await res.json();

  if (!profile.allowed) {
    await auth.signOut();
    loginMessage.textContent = "Your email is not authorised.";
    showLogin();
    return;
  }

  currentProfile = profile;
  showDashboard(user, profile);

  if (profile.ageGroup && ageGroupSelect.value === "") {
    ageGroupSelect.value = profile.ageGroup;
  }

  await loadPlayerEntries(user);

  if (isFullAccess(profile)) enableCaptainView(user);
  else disableCaptainView();
});

logoutBtn.addEventListener("click", () => auth.signOut());

function isFullAccess(profile) {
  const role = (profile.role || "").toLowerCase();
  return role === "captain" || role === "selector";
}

function showDashboard(user, profile) {
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
  userInfo.textContent = `${profile.displayName} (${user.email})`;
  roleBanner.textContent = isFullAccess(profile)
    ? "Role: Captain / Selector (full access)"
    : "Role: Player (your entries only)";
}

function showLogin() {
  dashboard.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

/* ------------------------------
   ADD ENTRY
--------------------------------*/
addEntryBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || !currentProfile) return;

  const ageGroup = ageGroupSelect.value;
  const start = startInput.value;
  const end = endInput.value;

  if (!ageGroup || !start || !end) {
    formMessage.textContent = "Please fill in all fields.";
    return;
  }

  const payload = {
    action: "addAvailability",
    data: {
      status: "Active",
      version: "1.0",
      event: "Unavailable",
      ageGroup,
      startDateTime: start,
      endDateTime: end,
      playerName: currentProfile.displayName,
      playerEmail: user.email
    }
  };

  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  formMessage.textContent = "Unavailability added.";
  startInput.value = "";
  endInput.value = "";

  await loadPlayerEntries(user);
  if (isFullAccess(currentProfile)) await loadAllEntries();
});

/* ------------------------------
   LOAD PLAYER ENTRIES
--------------------------------*/
async function loadPlayerEntries(user) {
  playerTableBody.innerHTML = "";

  const res = await fetch(
    `${SCRIPT_URL}?action=getAvailability&email=${encodeURIComponent(
      user.email
    )}`
  );
  const data = await res.json();

  data.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.ageGroup}</td>
      <td>${row.startDateTime}</td>
      <td>${row.endDateTime}</td>
      <td>${row.status}</td>
      <td><button data-id="${row.eventId}" class="delete-btn">Delete</button></td>
    `;
    playerTableBody.appendChild(tr);
  });

  playerTableBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteEntry(btn.dataset.id, user)
    );
  });
}

/* ------------------------------
   CAPTAIN VIEW
--------------------------------*/
function enableCaptainView(user) {
  captainControls.classList.remove("hidden");
  captainTableWrapper.classList.remove("hidden");

  refreshAllBtn.onclick = () => loadAllEntries();
  captainAgeFilter.onchange = () => loadAllEntries();

  loadAllEntries();
}

function disableCaptainView() {
  captainControls.classList.add("hidden");
  captainTableWrapper.classList.add("hidden");
}

async function loadAllEntries() {
  captainTableBody.innerHTML = "";
  const filterAge = captainAgeFilter.value;

  const res = await fetch(`${SCRIPT_URL}?action=getAllAvailability`);
  const data = await res.json();

  data
    .filter((row) => !filterAge || row.ageGroup === filterAge)
    .forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.playerName}</td>
        <td>${row.playerEmail}</td>
        <td>${row.ageGroup}</td>
        <td>${row.startDateTime}</td>
        <td>${row.endDateTime}</td>
        <td>${row.status}</td>
        <td><button data-id="${row.eventId}" class="delete-btn">Delete</button></td>
      `;
      captainTableBody.appendChild(tr);
    });

  captainTableBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteEntry(btn.dataset.id, auth.currentUser)
    );
  });
}

/* ------------------------------
   DELETE ENTRY
--------------------------------*/
async function deleteEntry(eventId, user) {
  const payload = {
    action: "deleteAvailability",
    eventId,
    email: user.email
  };

  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  await loadPlayerEntries(user);
  if (isFullAccess(currentProfile)) await loadAllEntries();
}
