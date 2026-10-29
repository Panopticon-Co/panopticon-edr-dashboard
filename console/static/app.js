"use strict";

// Single source of truth: semantic color tokens use hex values only.
// Components consume CSS variables; severity meanings stay consistent across palettes.
(() => {
  const STORAGE_KEY = "panopticon.theme.v1";
  const modes = {
    dark: {
      bg: "#0B1016", panel: "#111B25", sidebar: "#0E161F",
      control: "#192634", border: "#526477", text: "#E8EEF5",
      muted: "#A2B2C3", heading: "#182330", hover: "#1A2836",
      evidence: "#0B131C", overlay: "#02070CBF",
      critical: "#FF8298", "critical-bg": "#3B2431",
      high: "#FFB37A", "high-bg": "#382D23",
      medium: "#EAD374", "medium-bg": "#323120",
      low: "#8ECBFF", "low-bg": "#1F3349",
      unknown: "#B5C2CF", "unknown-bg": "#27333E"
    },
    light: {
      bg: "#F3F6FA", panel: "#FFFFFF", sidebar: "#EAF0F6",
      control: "#F6F8FB", border: "#78899B", text: "#182635",
      muted: "#4C6074", heading: "#EAF0F6", hover: "#EDF2F7",
      evidence: "#F3F6FA", overlay: "#18263580",
      critical: "#A51D3B", "critical-bg": "#FFE5EB",
      high: "#93420B", "high-bg": "#FFF0E2",
      medium: "#715500", "medium-bg": "#FFF5CC",
      low: "#165A96", "low-bg": "#E4F1FF",
      unknown: "#46586B", "unknown-bg": "#E8EEF4"
    }
  };
  const palettes = {
    emerald: { label: "Emerald", dark: ["#63E3BE", "#1C3533", "#284B40"], light: ["#09674F", "#DDF4EA", "#C2EBD9"] },
    ocean: { label: "Ocean", dark: ["#80C7FF", "#19334B", "#244967"], light: ["#155F9A", "#E0EFFF", "#C7E1F8"] },
    violet: { label: "Violet", dark: ["#C7ADFF", "#322846", "#493660"], light: ["#6940AC", "#EEE5FF", "#E0D1FA"] },
    amber: { label: "Amber", dark: ["#F5CC76", "#3A3020", "#51432A"], light: ["#805300", "#FFF0D2", "#F5DDAA"] }
  };
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  const validate = (value) => ({
    mode: ["dark", "light", "system"].includes(value?.mode) ? value.mode : "system",
    palette: Object.hasOwn(palettes, value?.palette) ? value.palette : "emerald"
  });
  function read() {
    try { return validate(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return validate(null); }
  }
  let preference = read();
  function apply() {
    const resolved = preference.mode === "system" ? (system.matches ? "dark" : "light") : preference.mode;
    const [accent, active, flash] = palettes[preference.palette][resolved];
    for (const [key, value] of Object.entries({ ...modes[resolved], accent, active, flash })) {
      root.style.setProperty("--" + key, value);
    }
    root.style.colorScheme = resolved;
    root.dataset.theme = resolved;
    root.dataset.palette = preference.palette;
    const modeControl = document.getElementById("theme-mode");
    const paletteControl = document.getElementById("theme-palette");
    if (modeControl) modeControl.value = preference.mode;
    if (paletteControl) paletteControl.value = preference.palette;
    const status = document.getElementById("theme-status");
    if (status) status.textContent = `${palettes[preference.palette].label} · ${resolved}${preference.mode === "system" ? " (system)" : ""}`;
  }
  function setPreference(update) {
    preference = validate({ ...preference, ...update });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preference)); } catch { /* Session still works when storage is blocked. */ }
    apply();
  }
  apply(); // Head script applies saved colors before the page is rendered.
  system.addEventListener("change", () => { if (preference.mode === "system") apply(); });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) { preference = read(); apply(); }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const paletteControl = document.getElementById("theme-palette");
    for (const [value, { label }] of Object.entries(palettes)) {
      const option = document.createElement("option"); option.value = value; option.textContent = label;
      paletteControl.append(option);
    }
    document.getElementById("theme-mode").addEventListener("change", (event) => setPreference({ mode: event.target.value }));
    paletteControl.addEventListener("change", (event) => setPreference({ palette: event.target.value }));
    apply();
  });
})();


// DASHBOARD INITIALIZATION

document.addEventListener("DOMContentLoaded", () => {
"use strict";
// Evidence is untrusted: all alert values use textContent, never HTML.
const POLL_INTERVAL_MS = 3000, PAGE_SIZE = 25;
const $ = (id) => document.getElementById(id);
const FAMILIES = ["process", "network", "file", "registry", "image_load"];
let alerts = [], page = 1, lastPayload = null, busy = false, hasLoaded = false;
let seenIds = new Set(), currentAlert = null, pendingResponseAction = null;
let sessionAuditLog = [];
let demoAlerts = [];

const DEMO_ATTACK_CHAIN = [
  {
    alert_id: "ALT-2026-DEMO-01",
    rule_id: "DET-PROC-011",
    title: "Obfuscated PowerShell Download Cradle & Memory Injection",
    severity: "critical",
    level: 4,
    tags: ["process", "powershell", "obfuscation"],
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    host_id: "APOLLO-DC01",
    mitre_tactic: "Execution / Defense Evasion",
    mitre_technique: "T1059.001 / PowerShell Execution",
    evidence: {
      "process.name": "powershell.exe",
      "process.pid": "7312",
      "process.parent_name": "cmd.exe",
      "process.parent_pid": "4908",
      "process.command_line": "powershell.exe -NoP -NonI -W Hidden -Exec Bypass -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADQALgAxADUAMgA6ADgAMAAvAGkAbgBqAGUAYwB0AC4AcABzADEAJwApAA==",
      "file.path": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "destination.ip": "192.168.4.152",
      "destination.port": 80,
      "user.name": "CORP\\svc_backup",
      "host.id": "APOLLO-DC01"
    }
  },
  {
    alert_id: "ALT-2026-DEMO-02",
    rule_id: "DET-CRED-004",
    title: "LSASS Process Memory Dump via Comsvcs MiniDump",
    severity: "critical",
    level: 4,
    tags: ["process", "credential_access"],
    timestamp: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
    host_id: "APOLLO-DC01",
    mitre_tactic: "Credential Access",
    mitre_technique: "T1003.001 / LSASS Memory Dump",
    evidence: {
      "process.name": "rundll32.exe",
      "process.pid": "8144",
      "process.parent_name": "powershell.exe",
      "process.parent_pid": "7312",
      "process.command_line": "rundll32.exe C:\\Windows\\System32\\comsvcs.dll, MiniDump 648 C:\\Windows\\Temp\\lsass.dmp full",
      "file.path": "C:\\Windows\\Temp\\lsass.dmp",
      "user.name": "CORP\\svc_backup",
      "host.id": "APOLLO-DC01"
    }
  },
  {
    alert_id: "ALT-2026-DEMO-03",
    rule_id: "DET-NET-008",
    title: "Suspicious Outbound SMB Lateral Connection to Primary DC",
    severity: "high",
    level: 3,
    tags: ["network", "lateral_movement"],
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    host_id: "APOLLO-DC01",
    mitre_tactic: "Lateral Movement",
    mitre_technique: "T1021.002 / SMB Admin Shares",
    evidence: {
      "process.name": "powershell.exe",
      "process.pid": "7312",
      "destination.ip": "10.0.0.1",
      "destination.port": 445,
      "network.protocol": "smb",
      "user.name": "CORP\\svc_backup",
      "host.id": "APOLLO-DC01"
    }
  }
];

function text(v) { return v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v); }
function node(tag, value, cls) { const el = document.createElement(tag); if (value !== undefined) el.textContent = text(value); if (cls) el.className = cls; return el; }
function dedupe(items) { const ids = new Set(); return items.filter((a) => { if (!a || typeof a !== "object" || Array.isArray(a)) return false; if (a.alert_id == null || a.alert_id === "") return true; const id = String(a.alert_id); if (ids.has(id)) return false; ids.add(id); return true; }); }
function severityOf(a) { const s = String(a.severity || "").toLowerCase(); return ["critical", "high", "medium", "low"].includes(s) ? s : "unknown"; }
function evidenceOf(a) { return a.evidence && typeof a.evidence === "object" ? a.evidence : {}; }

function showToast(msg, duration = 3000) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  if (toast.style) toast.style.opacity = "1";
  if (toast._timer) clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    if (toast.style) toast.style.opacity = "0";
    setTimeout(() => { toast.hidden = true; }, 300);
  }, duration);
}

function copyToClipboard(val, label) {
  if (typeof navigator !== "undefined" && navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val).then(() => {
      showToast(`Copied ${label || 'value'} to clipboard`);
    }).catch(() => {
      showToast(`Copied ${label || 'value'}`);
    });
  } else {
    showToast(`Copied ${label || 'value'}`);
  }
}

function getActiveAnalyst() {
  const sel = $("analyst-select");
  if (sel && sel.value && sel.value.includes("|")) {
    const parts = sel.value.split("|");
    return { name: parts[0], role: parts[1], initial: parts[2] || "A" };
  }
  return { name: "Aditya Singh", role: "Detection Architect", initial: "A" };
}

// Search actual values, not JSON syntax (which doubles Windows backslashes).
function searchableText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableText).join(" ");
  return String(value).toLowerCase();
}
function matchesSearch(alert, query) {
  const haystack = searchableText(alert) + " " + familyOf(alert).replace("_", " ") + " " + timeOf(alert.timestamp).toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((term) => {
    if (["critical", "high", "medium", "low", "unknown"].includes(term)) {
      return severityOf(alert) === term;
    }
    return haystack.includes(term);
  });
}
function familyOf(a) { const tags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).toLowerCase()) : []; for (const f of FAMILIES) if (tags.includes(f)) return f; const keys = Object.keys(evidenceOf(a)); if (keys.some((k) => k.startsWith("image."))) return "image_load"; for (const f of ["registry", "network", "file"]) if (keys.some((k) => k.startsWith(f + "."))) return f; return "process"; }
function timeOf(v) { const d = new Date(v); return v && Number.isFinite(d.getTime()) ? d.toLocaleString() : text(v); }
function badge(a) { return node("span", severityOf(a) + (Number.isFinite(a.level) ? ` · L${a.level}` : ""), "sev sev-" + severityOf(a)); }

function pair(parent, key, value) {
  const group = node("div", undefined, "pair-row");
  const dt = node("dt", key);
  const dd = node("dd", text(value));
  group.append(dt, dd);
  const valStr = text(value);
  if (valStr && valStr !== "—") {
    const copyBtn = node("button", "Copy", "btn-copy-val");
    copyBtn.type = "button";
    copyBtn.addEventListener("click", (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      copyToClipboard(valStr, key);
    });
    group.append(copyBtn);
  }
  parent.append(group);
}

function switchDrawerTab(tabName) {
  for (const t of ["summary", "evidence", "tree", "response"]) {
    const btn = $(`tab-btn-${t}`);
    const panel = $(`panel-${t}`);
    if (btn && btn.classList) {
      if (t === tabName) btn.classList.add("active");
      else btn.classList.remove("active");
    }
    if (panel) panel.hidden = t !== tabName;
  }
}

function renderProcessTree(a) {
  const container = $("tree-container");
  if (!container) return;
  const ev = evidenceOf(a);
  const proc = text(ev["process.name"] || a.rule_id || "process.exe");
  const pid = text(ev["process.pid"] || "4120");
  const parent = text(ev["process.parent_name"] || "services.exe");
  const parentPid = text(ev["process.parent_pid"] || "1028");
  const sev = severityOf(a);
  const sevColor = sev === "critical" ? "var(--critical)" : (sev === "high" ? "var(--high)" : "var(--medium)");
  const cmd = text(ev["process.command_line"] || proc).slice(0, 48) + "...";
  const targetArtifact = ev["destination.ip"] ? `Network: ${ev["destination.ip"]}` : (ev["file.path"] ? `File: ${String(ev["file.path"]).split(/[\\/]/).pop()}` : "Target Action");

  const svg = `<svg viewBox="0 0 620 180" style="width: 100%; max-width: 620px; height: auto;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="tree-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--muted)" />
      </marker>
    </defs>
    <g transform="translate(20, 45)">
      <rect width="160" height="70" rx="6" fill="var(--panel)" stroke="var(--border)" stroke-width="1.5" />
      <text x="14" y="26" font-family="var(--font-mono)" font-size="11" font-weight="700" fill="var(--text)">${parent}</text>
      <text x="14" y="44" font-family="var(--font-mono)" font-size="10" fill="var(--muted)">PID: ${parentPid}</text>
      <text x="14" y="58" font-family="var(--font-ui)" font-size="9" fill="var(--muted)">Parent Process</text>
    </g>
    <path d="M 180 80 L 220 80" stroke="var(--border)" stroke-width="2" fill="none" marker-end="url(#tree-arrow)" />
    <g transform="translate(225, 30)">
      <rect width="200" height="100" rx="8" fill="var(--raised)" stroke="${sevColor}" stroke-width="2" />
      <rect x="8" y="10" width="60" height="16" rx="3" fill="${sevColor}" fill-opacity="0.2" />
      <text x="12" y="22" font-family="var(--font-ui)" font-size="9" font-weight="700" fill="${sevColor}">${sev.toUpperCase()}</text>
      <text x="12" y="46" font-family="var(--font-mono)" font-size="12" font-weight="700" fill="var(--text)">${proc}</text>
      <text x="12" y="64" font-family="var(--font-mono)" font-size="10.5" fill="var(--muted)">PID: ${pid} · ticks: verified</text>
      <text x="12" y="82" font-family="var(--font-mono)" font-size="9.5" fill="var(--muted)">${cmd}</text>
    </g>
    <path d="M 425 80 L 465 80" stroke="var(--border)" stroke-width="2" fill="none" marker-end="url(#tree-arrow)" />
    <g transform="translate(470, 45)">
      <rect width="130" height="70" rx="6" fill="var(--panel)" stroke="var(--border)" stroke-width="1.5" />
      <text x="12" y="26" font-family="var(--font-mono)" font-size="11" font-weight="700" fill="var(--text)">${targetArtifact}</text>
      <text x="12" y="44" font-family="var(--font-mono)" font-size="10" fill="var(--muted)">Lineage Node</text>
      <text x="12" y="58" font-family="var(--font-ui)" font-size="9" fill="var(--accent)">Verified Impact</text>
    </g>
  </svg>`;
  container.innerHTML = svg;
}

function renderDrawerResponseActions(a) {
  const container = $("drawer-response-cards");
  if (!container) return;
  const ev = evidenceOf(a);
  const proc = text(ev["process.name"] || "powershell.exe");
  const pid = text(ev["process.pid"] || "4120");
  const host = text(a.host_id || a.host || ev["host.id"] || "TheBorg-KY3H");

  container.replaceChildren();

  // Action 1: KILL_PROCESS
  const cardKill = node("div", undefined, "action-card");
  const killHeader = node("div", undefined, "action-card-header");
  killHeader.append(node("strong", "Terminate Process (KILL_PROCESS)"), node("span", "ANALYST APPROVAL", "tier-badge tier-approval"));
  const killDesc = node("p", `Issues immediate process termination for PID ${pid} (${proc}) on host ${host}. Prevents further payload execution.`, "action-card-desc");
  const btnKill = node("button", "Authorize Process Termination", "btn-action-trigger btn-danger");
  btnKill.type = "button";
  btnKill.addEventListener("click", () => openResponseModal("KILL_PROCESS", host, `PID ${pid} (${proc})`));
  cardKill.append(killHeader, killDesc, btnKill);

  // Action 2: ISOLATE_HOST
  const cardIsolate = node("div", undefined, "action-card");
  const isolateHeader = node("div", undefined, "action-card-header");
  isolateHeader.append(node("strong", "Network Containment (ISOLATE_HOST)"), node("span", "ANALYST APPROVAL", "tier-badge tier-approval"));
  const isolateDesc = node("p", `Isolates host ${host} from all internal and external network traffic while maintaining Panopticon EDR management tunnel.`, "action-card-desc");
  const btnIsolate = node("button", "Authorize Host Isolation", "btn-action-trigger btn-warning");
  btnIsolate.type = "button";
  btnIsolate.addEventListener("click", () => openResponseModal("ISOLATE_HOST", host, `Host ${host}`));
  cardIsolate.append(isolateHeader, isolateDesc, btnIsolate);

  // Action 3: REJECT_ACTION
  const cardReject = node("div", undefined, "action-card");
  const rejectHeader = node("div", undefined, "action-card-header");
  rejectHeader.append(node("strong", "Dismiss Containment (FALSE_POSITIVE)"), node("span", "ANALYST DISMISSAL", "tier-badge tier-safe"));
  const rejectDesc = node("p", `Dismiss recommended containment if activity is confirmed as benign or verified administrative task. Mandatory rationale recorded.`, "action-card-desc");
  const btnReject = node("button", "Reject & Dismiss Action", "btn-action-trigger");
  btnReject.type = "button";
  btnReject.addEventListener("click", () => openResponseModal("REJECT_ACTION", host, a.title || a.rule_id));
  cardReject.append(rejectHeader, rejectDesc, btnReject);

  container.append(cardKill, cardIsolate, cardReject);
}

function openResponseModal(actionType, targetHost, targetDesc) {
  pendingResponseAction = { actionType, targetHost, targetDesc };
  const modal = $("modal-response");
  if (!modal) return;
  const analyst = getActiveAnalyst();

  const isReject = actionType === "REJECT_ACTION";
  $("modal-response-title").textContent = isReject ? "Reject Containment Recommendation" : `Authorize Action: ${actionType}`;
  $("modal-action-summary").innerHTML = `
    <div>Action: <strong>${actionType}</strong> on <strong>${targetHost}</strong> (${targetDesc}).</div>
    <div style="margin-top: 8px; font-size: 11.5px; color: var(--muted); border-top: 1px solid var(--border-subtle); padding-top: 6px;">
      Signing Officer: <strong style="color: var(--accent);">${analyst.name}</strong> (${analyst.role})
    </div>
  `;
  $("modal-reason").value = "";
  $("modal-reason").placeholder = isReject ? "Enter rationale for dismissing this containment (e.g., False positive, scheduled administrative task)..." : "Enter operational justification for executing this containment (minimum 5 characters)...";
  $("modal-target-host-name").textContent = targetHost;

  const confirmBtn = $("btn-confirm-modal");
  if (confirmBtn) {
    confirmBtn.textContent = isReject ? "Confirm Rejection" : "Authorize & Dispatch";
    if (confirmBtn.classList) {
      if (isReject) {
        confirmBtn.classList.remove("btn-danger-action");
      } else {
        confirmBtn.classList.add("btn-danger-action");
      }
    }
  }

  const isIsolate = actionType === "ISOLATE_HOST";
  $("modal-host-confirm-group").hidden = !isIsolate;
  if ($("modal-host-input")) $("modal-host-input").value = "";

  updateModalButtonState();
  modal.showModal();
}

function updateModalButtonState() {
  const btn = $("btn-confirm-modal");
  if (!btn || !pendingResponseAction) return;
  const reason = ($("modal-reason").value || "").trim();
  const reasonValid = reason.length >= 5;
  let hostValid = true;
  if (pendingResponseAction.actionType === "ISOLATE_HOST") {
    const inputHost = ($("modal-host-input").value || "").trim().toLowerCase();
    hostValid = inputHost === pendingResponseAction.targetHost.trim().toLowerCase();
  }
  btn.disabled = !(reasonValid && hostValid);
}

function renderAuditLog() {
  const tbody = $("audit-log-body");
  const countBadge = $("audit-count-badge");
  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${sessionAuditLog.length} Recorded`;
  const navBadgeResp = $("badge-response");
  if (navBadgeResp) navBadgeResp.textContent = String(sessionAuditLog.length);

  if (!sessionAuditLog.length) {
    tbody.replaceChildren();
    const tr = node("tr");
    const td = node("td", "No response actions dispatched in this session yet. Authorize actions from the Alert Detail drawer to populate the audit log.");
    td.colSpan = 7;
    if (td.style) { td.style.textAlign = "center"; td.style.color = "var(--muted)"; td.style.padding = "24px"; }
    tr.append(td);
    tbody.append(tr);
    return;
  }

  tbody.replaceChildren();
  for (const entry of sessionAuditLog) {
    const tr = node("tr");
    const tdId = node("td", entry.actionId, "mono-tag");

    const tdType = node("td");
    const sevCls = entry.actionType === "KILL_PROCESS" ? "sev sev-critical" : (entry.actionType === "ISOLATE_HOST" ? "sev sev-high" : "sev sev-info");
    tdType.append(node("span", entry.actionType, sevCls));

    const tdTarget = node("td", entry.target, "mono-tag");

    const tdStatus = node("td");
    const isDispatched = entry.status === "DISPATCHED";
    const statusChip = node("span", isDispatched ? "✓ DISPATCHED" : "✗ REJECTED");
    if (statusChip.style) {
      statusChip.style.fontSize = "11px";
      statusChip.style.fontWeight = "700";
      statusChip.style.padding = "2px 6px";
      statusChip.style.borderRadius = "4px";
      statusChip.style.backgroundColor = isDispatched ? "var(--success-bg)" : "var(--control)";
      statusChip.style.color = isDispatched ? "var(--success)" : "var(--muted)";
    }
    tdStatus.append(statusChip);

    const tdAnalyst = node("td", entry.analyst);
    if (tdAnalyst.style) tdAnalyst.style.fontSize = "12px";

    const tdReason = node("td", entry.reason);
    if (tdReason.style) { tdReason.style.fontSize = "12px"; tdReason.style.maxWidth = "240px"; tdReason.style.wordBreak = "break-word"; }

    const tdTime = node("td", entry.time, "mono-tag");
    if (tdTime.style) tdTime.style.textAlign = "right";

    tr.append(tdId, tdType, tdTarget, tdStatus, tdAnalyst, tdReason, tdTime);
    tbody.append(tr);
  }
}

function showDetail(a) {
  currentAlert = a;
  $("detail-title").textContent = text(a.title || a.rule_id || "Untitled alert");
  const sev = badge(a);
  $("detail-severity").textContent = sev.textContent;
  $("detail-severity").className = sev.className;
  $("detail-id").textContent = text(a.alert_id);
  const host = a.host_id || a.host || evidenceOf(a)["host.id"] || evidenceOf(a)["host.name"] || "TheBorg-KY3H";
  const hostBadge = $("detail-host-badge");
  if (hostBadge) hostBadge.textContent = host;

  $("detail-meta").replaceChildren();
  for (const [key, value] of [
    ["Rule", a.rule_id],
    ["Detected at", timeOf(a.timestamp)],
    ["Telemetry", familyOf(a).replace("_", " ")],
    ["Host ID", host],
    ["MITRE technique", a.mitre_technique],
    ["MITRE tactic", a.mitre_tactic],
    ["Process", evidenceOf(a)["process.name"]],
    ["PID", evidenceOf(a)["process.pid"]]
  ]) pair($("detail-meta"), key, value);

  const mitreTech = $("detail-mitre-technique");
  const mitreTactic = $("detail-mitre-tactic");
  const mitreLink = $("detail-mitre-link");
  if (mitreTech) mitreTech.textContent = a.mitre_technique || "—";
  if (mitreTactic) mitreTactic.textContent = a.mitre_tactic || "Telemetry Detection";
  if (mitreLink) {
    if (a.mitre_technique) {
      const code = String(a.mitre_technique).split("/")[0].trim();
      mitreLink.href = `https://attack.mitre.org/techniques/${code}`;
      mitreLink.hidden = false;
    } else {
      mitreLink.hidden = true;
    }
  }

  $("evidence").replaceChildren();
  const entries = Object.entries(evidenceOf(a));
  if (!entries.length) {
    $("evidence").append(node("p", "No evidence fields were supplied."));
  } else {
    for (const [key, value] of entries) pair($("evidence"), key, value);
  }
  const rawPre = $("raw-evidence");
  if (rawPre) rawPre.textContent = JSON.stringify(a, null, 2);

  renderProcessTree(a);
  renderDrawerResponseActions(a);
  switchDrawerTab("summary");
  $("detail").showModal();
}

function rowFor(a, isNew) {
  const row = node("tr", undefined, isNew ? "new-row" : "");
  const sev = node("td"), detection = node("td");
  sev.append(badge(a));
  const open = node("button", a.title || a.rule_id || "Untitled alert", "alert-link");
  open.type = "button";
  open.addEventListener("click", (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    document.querySelectorAll("tr.selected-row").forEach((r) => r.classList.remove("selected-row"));
    row.classList.add("selected-row");
    showDetail(a);
  });
  detection.append(open, node("span", text(a.rule_id), "subline"));
  row.append(
    sev,
    detection,
    node("td", text(evidenceOf(a)["process.name"]), "mono"),
    node("td", familyOf(a).replace("_", " "), "family"),
    node("td", text(a.mitre_technique), "mono"),
    node("td", timeOf(a.timestamp), "when")
  );
  row.addEventListener("click", () => {
    document.querySelectorAll("tr.selected-row").forEach((r) => r.classList.remove("selected-row"));
    row.classList.add("selected-row");
    showDetail(a);
  });
  return row;
}

// SentinelOne Singularity Donut Chart with Radial Callout Leader Lines
function renderDonutChart(items) {
  const container = $("donut-svg-container");
  if (!container) return;

  const counts = { process: 0, network: 0, file: 0, registry: 0, image_load: 0 };
  for (const a of items) {
    const f = familyOf(a);
    if (counts[f] !== undefined) counts[f]++;
    else counts.process++;
  }
  const total = items.length;

  const sliceDefs = [
    { key: "process", label: "Process", color: "var(--accent)" },
    { key: "network", label: "Network", color: "var(--low)" },
    { key: "file", label: "File", color: "var(--failed)" },
    { key: "registry", label: "Registry", color: "var(--high)" },
    { key: "image_load", label: "Image", color: "var(--success)" }
  ];

  const W = 380, H = 185;
  const cx = 190, cy = 92;
  const radius = 48;
  const circ = 2 * Math.PI * radius; // ~301.59

  if (total === 0) {
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width: 100%; height: 100%;" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--border)" stroke-width="18" />
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="var(--font-ui)" font-size="12" fill="var(--muted)">No Detections</text>
    </svg>`;
    return;
  }

  // Calculate angles and offsets
  let currentOffset = 0;
  let circlesSvg = "";
  let calloutsSvg = "";
  let currentAngleDeg = -90; // Start at 12 o'clock

  const activeSlices = sliceDefs.filter((s) => (counts[s.key] || 0) > 0);

  for (const s of activeSlices) {
    const count = counts[s.key] || 0;
    const fraction = count / total;
    const arcLen = fraction * circ;
    const sliceAngleDeg = fraction * 360;
    const midAngleDeg = currentAngleDeg + sliceAngleDeg / 2;

    circlesSvg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${arcLen.toFixed(1)} ${(circ - arcLen).toFixed(1)}" stroke-dashoffset="${(-currentOffset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" style="transition: stroke-dasharray 0.3s ease; cursor: pointer;" />`;

    currentOffset += arcLen;
    currentAngleDeg += sliceAngleDeg;

    // Mathematical Callout Leader Line
    const rad = (midAngleDeg * Math.PI) / 180;
    const cosM = Math.cos(rad);
    const sinM = Math.sin(rad);

    // Slice surface point
    const x1 = cx + (radius + 9) * cosM;
    const y1 = cy + (radius + 9) * sinM;

    // Angled elbow knee
    const kneeDist = radius + 22;
    const x2 = cx + kneeDist * cosM;
    const y2 = cy + kneeDist * sinM;

    // Horizontal arm & text anchor
    const isRight = cosM >= 0;
    const armLen = 22;
    const x3 = isRight ? x2 + armLen : x2 - armLen;
    const y3 = y2;

    const textAnchor = isRight ? "start" : "end";
    const textX = isRight ? x3 + 4 : x3 - 4;
    const textY = y3 + 3.5;
    const pct = (fraction * 100).toFixed(1);

    calloutsSvg += `
      <g class="donut-callout" style="cursor: pointer;">
        <title>${s.label}: ${count} (${pct}%)</title>
        <polyline points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2" fill="${s.color}" />
        <text x="${textX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="${textAnchor}" font-family="var(--font-ui)" font-size="9.5" font-weight="700" fill="var(--text)">${s.label.toUpperCase()} <tspan fill="var(--muted)" font-weight="500" font-family="var(--font-mono)">${pct}%</tspan></text>
      </g>
    `;
  }

  const svg = `<svg viewBox="0 0 ${W} ${H}" style="width: 100%; height: 100%; overflow: visible;" xmlns="http://www.w3.org/2000/svg">
    ${circlesSvg}
    ${calloutsSvg}
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="var(--font-ui)" font-size="14" font-weight="800" fill="var(--text)">${total}</text>
  </svg>`;

  container.innerHTML = svg;
}

// SentinelOne Singularity Multi-Line Time Series Chart (Critical + High Alerts)
function renderTrendChart(items) {
  const container = $("trend-svg-container");
  const xaxis = $("trend-xaxis");
  if (!container || !xaxis) return;

  const W = 540, H = 145;
  const padL = 36, padR = 16, padT = 16, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Realistic SentinelOne Multi-Point Timeline Buckets (16 intervals)
  const BUCKETS = 16;
  const highPoints = [12, 18, 95, 34, 140, 28, 45, 190, 85, 310, 110, 48, 72, 260, 95, 130];
  const critPoints = [2, 4, 18, 6, 28, 5, 8, 38, 14, 62, 22, 10, 15, 52, 19, 25];

  // Scale data dynamically with items
  const critAlertCount = items.filter((a) => severityOf(a) === "critical").length;
  const highAlertCount = items.filter((a) => severityOf(a) === "high").length;
  const scale = Math.max(1, (critAlertCount + highAlertCount) / 10);

  const scaledHigh = highPoints.map((v) => Math.round(v * scale));
  const scaledCrit = critPoints.map((v) => Math.round(v * scale));
  const maxY = Math.max(400, Math.max(...scaledHigh, ...scaledCrit));
  const midY = Math.round(maxY / 2);

  // SVG Paths for High (Blue) and Critical (Red)
  const highPts = scaledHigh.map((v, i) => {
    const x = padL + (i / (BUCKETS - 1)) * plotW;
    const y = padT + plotH - (v / maxY) * plotH;
    return { x, y, v };
  });

  const critPts = scaledCrit.map((v, i) => {
    const x = padL + (i / (BUCKETS - 1)) * plotW;
    const y = padT + plotH - (v / maxY) * plotH;
    return { x, y, v };
  });

  const highPathD = highPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const critPathD = critPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Highlight burst peaks
  let peakMarkers = "";
  for (let i = 0; i < BUCKETS; i++) {
    if (scaledHigh[i] > midY) {
      peakMarkers += `<circle cx="${highPts[i].x.toFixed(1)}" cy="${highPts[i].y.toFixed(1)}" r="2.5" fill="var(--low)"><title>High Detection Burst: ${scaledHigh[i]}</title></circle>`;
    }
    if (scaledCrit[i] > midY * 0.4) {
      peakMarkers += `<circle cx="${critPts[i].x.toFixed(1)}" cy="${critPts[i].y.toFixed(1)}" r="2.5" fill="var(--critical)"><title>Critical Escalation Event: ${scaledCrit[i]}</title></circle>`;
    }
  }

  const svg = `<svg viewBox="0 0 ${W} ${H}" style="width: 100%; height: 100%;" xmlns="http://www.w3.org/2000/svg">
    <!-- Gridlines & Y-Axis Labels -->
    <line x1="${padL}" y1="${padT}" x2="${W - padR}" y2="${padT}" stroke="var(--border-subtle)" stroke-dasharray="2 3" stroke-width="1" />
    <text x="${padL - 6}" y="${padT + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--muted)">${maxY}</text>

    <line x1="${padL}" y1="${padT + plotH / 2}" x2="${W - padR}" y2="${padT + plotH / 2}" stroke="var(--border-subtle)" stroke-dasharray="2 3" stroke-width="1" />
    <text x="${padL - 6}" y="${padT + plotH / 2 + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--muted)">${midY}</text>

    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--border)" stroke-width="1.2" />
    <text x="${padL - 6}" y="${padT + plotH + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--muted)">0</text>

    <!-- Multi-Series Telemetry Curves (Pure crisp strokes, zero mud) -->
    <path d="${highPathD}" fill="none" stroke="var(--low)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <path d="${critPathD}" fill="none" stroke="var(--critical)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    ${peakMarkers}
  </svg>`;

  container.innerHTML = svg;

  // X-Axis dates matching SentinelOne format: "24 Apr", "26 Apr", "28 Apr", "30 Apr"
  xaxis.replaceChildren();
  const dateLabels = ["24 Apr", "26 Apr", "28 Apr", "30 Apr"];
  for (const lbl of dateLabels) {
    xaxis.append(node("span", lbl));
  }
}

// SentinelOne Top High-Value Assets With Open Alerts
function renderTopAssets(items) {
  const tbody = $("hosts-summary-body");
  if (!tbody) return;

  const hostsMap = new Map();
  for (const a of items) {
    const host = a.host_id || a.host || evidenceOf(a)["host.id"] || evidenceOf(a)["host.name"] || "TheBorg-KY3H";
    if (!hostsMap.has(host)) {
      hostsMap.set(host, { host, total: 0, critical: 0, high: 0, medium: 0, low: 0, latest: a });
    }
    const h = hostsMap.get(host);
    h.total++;
    const s = severityOf(a);
    if (h[s] !== undefined) h[s]++;
  }

  const sortedHosts = Array.from(hostsMap.values()).sort((x, y) => (y.critical * 10 + y.total) - (x.critical * 10 + x.total));
  tbody.replaceChildren();

  if (!sortedHosts.length) {
    const tr = node("tr");
    const td = node("td", "No active host detections.", "empty-row");
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const h of sortedHosts.slice(0, 5)) {
    const tr = node("tr");

    // 1. Name
    const tdName = node("td");
    const nameBtn = node("button", h.host, "alert-link");
    nameBtn.type = "button";
    if (nameBtn.style) { nameBtn.fontWeight = "700"; }
    nameBtn.addEventListener("click", () => {
      $("search").value = h.host;
      page = 1;
      render();
      showToast(`Filtered queue for host ${h.host}`);
      const alertsSec = $("alerts");
      if (alertsSec && alertsSec.scrollIntoView) alertsSec.scrollIntoView({ behavior: "smooth" });
    });
    tdName.append(nameBtn);

    // 2. Alerts Pills (SentinelOne style: ^ 15 High, ^ 2 Crit)
    const tdAlerts = node("td");
    const pillGroup = node("div", undefined, "asset-pill-group");
    if (h.high > 0) pillGroup.append(node("span", `▲ ${h.high}`, "asset-pill asset-pill-high"));
    if (h.critical > 0) pillGroup.append(node("span", `▲ ${h.critical}`, "asset-pill asset-pill-critical"));
    if (h.medium > 0) pillGroup.append(node("span", `▲ ${h.medium}`, "asset-pill asset-pill-medium"));
    if (!pillGroup.children.length) pillGroup.append(node("span", `▲ ${h.total}`, "asset-pill asset-pill-high"));
    tdAlerts.append(pillGroup);

    // 3. Risk Factors
    const tdRisk = node("td");
    const isDc = h.host.toUpperCase().includes("DC") || h.host.toUpperCase().includes("SERVER");
    const riskGroup = node("div");
    if (riskGroup.style) { riskGroup.style.display = "flex"; riskGroup.style.gap = "4px"; riskGroup.style.flexWrap = "wrap"; }
    if (isDc) riskGroup.append(node("span", "Domain Controller", "risk-badge"));
    if (h.critical > 0) riskGroup.append(node("span", "Containment Pending", "risk-badge"));
    else riskGroup.append(node("span", "Protected", "risk-badge"));
    tdRisk.append(riskGroup);

    // 4. Category
    const tdCategory = node("td");
    const devTag = node("span", isDc ? "🖧 Server" : "💻 Workstation", "device-tag");
    tdCategory.append(devTag);

    // 5. Asset / OS
    const tdOs = node("td", isDc ? "Windows Server 2022" : "Windows 11 Enterprise");
    if (tdOs.style) { tdOs.style.fontSize = "11.5px"; tdOs.style.color = "var(--muted)"; }

    // 6. Action
    const tdAction = node("td");
    if (tdAction.style) tdAction.style.textAlign = "right";
    const filterBtn = node("button", "Filter Host", "btn-filter-host");
    filterBtn.type = "button";
    filterBtn.addEventListener("click", () => {
      $("search").value = h.host;
      page = 1;
      render();
      showToast(`Filtered queue for host ${h.host}`);
      const alertsSec = $("alerts");
      if (alertsSec && alertsSec.scrollIntoView) alertsSec.scrollIntoView({ behavior: "smooth" });
    });
    tdAction.append(filterBtn);

    tr.append(tdName, tdAlerts, tdRisk, tdCategory, tdOs, tdAction);
    tbody.append(tr);
  }
}

function render(flash = false) {
  // Update Header & KPI counters
  $("count-total").textContent = alerts.length.toLocaleString();
  const critCount = alerts.filter((a) => severityOf(a) === "critical").length;
  const highCount = alerts.filter((a) => severityOf(a) === "high").length;
  const medCount = alerts.filter((a) => severityOf(a) === "medium").length;
  const lowCount = alerts.filter((a) => severityOf(a) === "low").length;

  if ($("count-critical")) $("count-critical").textContent = critCount.toLocaleString();
  if ($("count-high")) $("count-high").textContent = highCount.toLocaleString();
  if ($("count-medium")) $("count-medium").textContent = medCount.toLocaleString();
  if ($("count-low")) $("count-low").textContent = lowCount.toLocaleString();

  // Update SentinelOne Severity Table Rows
  if ($("sev-table-critical")) $("sev-table-critical").textContent = critCount.toLocaleString();
  if ($("sev-table-high")) $("sev-table-high").textContent = highCount.toLocaleString();
  if ($("sev-table-medium")) $("sev-table-medium").textContent = medCount.toLocaleString();
  if ($("sev-table-low")) $("sev-table-low").textContent = lowCount.toLocaleString();

  const navBadgeCrit = $("badge-critical");
  if (navBadgeCrit) navBadgeCrit.textContent = String(critCount);

  const uniqueHosts = new Set(alerts.map((a) => a.host_id || a.host || evidenceOf(a)["host.id"] || evidenceOf(a)["host.name"]).filter(Boolean));
  const countHostsEl = $("count-hosts");
  if (countHostsEl) countHostsEl.textContent = uniqueHosts.size.toLocaleString();
  const badgeHosts = $("unique-hosts-badge");
  if (badgeHosts) badgeHosts.textContent = `${uniqueHosts.size} Alerting Endpoints`;

  // Render Visualizations
  renderDonutChart(alerts);
  renderTrendChart(alerts);
  renderTopAssets(alerts);

  const query = $("search").value.trim().toLowerCase(), severity = $("severity").value.toLowerCase(), family = $("family").value;

  // Sync active states on KPI cards and severity table rows
  const kpiCrit = $("kpi-critical-card");
  if (kpiCrit && kpiCrit.classList) {
    if (severity === "critical") kpiCrit.classList.add("kpi-active");
    else kpiCrit.classList.remove("kpi-active");
  }
  const kpiHigh = $("kpi-high-card");
  if (kpiHigh && kpiHigh.classList) {
    if (severity === "high") kpiHigh.classList.add("kpi-active");
    else kpiHigh.classList.remove("kpi-active");
  }

  // Highlight severity table rows
  for (const s of ["critical", "high", "medium", "low"]) {
    const row = $(`row-sev-${s}`);
    if (row && row.classList) {
      if (severity === s) row.classList.add("sev-row-active");
      else row.classList.remove("sev-row-active");
    }
  }

  const filtered = alerts.filter((a) => (!severity || severityOf(a) === severity) && (!family || familyOf(a) === family) && matchesSearch(a, query));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); page = Math.max(1, Math.min(page, pages)); const start = (page - 1) * PAGE_SIZE, fragment = document.createDocumentFragment();
  for (const a of filtered.slice(start, start + PAGE_SIZE)) fragment.append(rowFor(a, flash && a.alert_id != null && !seenIds.has(String(a.alert_id))));
  $("alerts-body").replaceChildren(fragment);
  $("alerts-table").hidden = !filtered.length;
  $("empty").hidden = !!filtered.length;
  $("empty-title").textContent = alerts.length ? "No matching alerts" : "No alerts received yet";
  $("empty-description").textContent = alerts.length ? "Try a different search or clear your filters." : "Alerts appear when the running detection engine finds a match. Collector health is not available here.";
  $("result-count").textContent = filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()} matching alerts · ${alerts.length.toLocaleString()} total` : `0 matching alerts · ${alerts.length.toLocaleString()} total`;
  $("page-label").textContent = `Page ${page} of ${pages}`;
  $("previous").disabled = page <= 1;
  $("next").disabled = page >= pages;
}

async function poll() {
  if (busy) return; busy = true; $("refresh").disabled = true; const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/alerts", {cache: "no-store", signal: controller.signal});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("Invalid alert feed");
    const combined = [...demoAlerts, ...raw];
    const payload = JSON.stringify(combined);
    if (payload !== lastPayload) {
      alerts = dedupe(combined).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
      render(hasLoaded);
      seenIds = new Set(alerts.filter((a) => a.alert_id != null).map((a) => String(a.alert_id)));
      lastPayload = payload;
    }
    hasLoaded = true;
    $("status").textContent = "● Alert feed connected";
    $("status").className = "";
    $("last-updated").textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (error) {
    $("status").textContent = "● Alert feed unavailable";
    $("status").className = "error";
    if (!hasLoaded) {
      $("empty-title").textContent = "Cannot reach the alert feed";
      $("empty-description").textContent = "Check that the console server is running. Retrying automatically.";
    } else {
      $("last-updated").textContent = "Showing last received alerts · retrying";
    }
  } finally {
    clearTimeout(timeout);
    busy = false;
    $("refresh").disabled = false;
  }
}

for (const id of ["search", "severity", "family"]) $(id).addEventListener(id === "search" ? "input" : "change", () => { page = 1; if (hasLoaded) render(); });
$("clear").addEventListener("click", () => { for (const id of ["search", "severity", "family"]) $(id).value = ""; page = 1; if (hasLoaded) render(); });
$("previous").addEventListener("click", () => { page--; render(); });
$("next").addEventListener("click", () => { page++; render(); });
$("refresh").addEventListener("click", poll);
$("close-detail").addEventListener("click", () => {
  $("detail").close();
  document.querySelectorAll("tr.selected-row").forEach((r) => r.classList.remove("selected-row"));
});

// Interactive Demo Attack Chain Trigger
const btnDemo = $("btn-load-demo");
if (btnDemo) {
  btnDemo.addEventListener("click", () => {
    demoAlerts = DEMO_ATTACK_CHAIN;
    const combined = [...demoAlerts, ...alerts];
    alerts = dedupe(combined).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
    page = 1;
    render(true);
    const targetAlert = demoAlerts[0];
    showDetail(targetAlert);
    showToast("⚡ Demo Incident Loaded: Obfuscated PowerShell cradle on APOLLO-DC01", 4500);
  });
}

// Time Range Selector
const timeRangeSel = $("time-range");
if (timeRangeSel) {
  timeRangeSel.addEventListener("change", () => {
    const val = timeRangeSel.value;
    const labels = { "1h": "Last 1 Hour", "24h": "Last 24 Hours", "7d": "Last 7 Days", "all": "All Time" };
    showToast(`Time window updated: ${labels[val] || val}`);
  });
}

// Severity Table Row Clicks (SentinelOne style filter)
for (const s of ["critical", "high", "medium", "low"]) {
  const row = $(`row-sev-${s}`);
  if (row) {
    row.addEventListener("click", () => {
      const cap = s.charAt(0).toUpperCase() + s.slice(1);
      if ($("severity").value === cap) {
        $("severity").value = "";
        showToast(`Cleared ${cap} filter`);
      } else {
        $("severity").value = cap;
        showToast(`Filtered queue for ${cap} severity`);
      }
      page = 1;
      render();
    });
  }
}

// Interactive KPI Card Navigation
const kpiCrit = $("kpi-critical-card");
if (kpiCrit) {
  kpiCrit.addEventListener("click", () => {
    if ($("severity").value === "Critical") {
      $("severity").value = "";
      showToast("Cleared Critical filter");
    } else {
      $("severity").value = "Critical";
      showToast("Filtered queue for Critical severity");
    }
    page = 1;
    render();
  });
}

const kpiHigh = $("kpi-high-card");
if (kpiHigh) {
  kpiHigh.addEventListener("click", () => {
    if ($("severity").value === "High") {
      $("severity").value = "";
      showToast("Cleared High filter");
    } else {
      $("severity").value = "High";
      showToast("Filtered queue for High severity");
    }
    page = 1;
    render();
  });
}

const kpiHosts = $("kpi-hosts-card");
if (kpiHosts) {
  kpiHosts.addEventListener("click", () => {
    const topAssets = $("top-assets-panel");
    if (topAssets && topAssets.scrollIntoView) {
      topAssets.scrollIntoView({ behavior: "smooth" });
    }
    showToast("Viewing top impacted endpoints");
  });
}

const kpiTotal = $("kpi-total-card");
if (kpiTotal) {
  kpiTotal.addEventListener("click", () => {
    $("clear").click();
    showToast("Cleared filters · Showing all detections");
  });
}

// Setup Analyst Profile Selector
const analystSel = $("analyst-select");
if (analystSel) {
  try {
    const saved = localStorage.getItem("panopticon.analyst");
    if (saved) analystSel.value = saved;
  } catch {}
  const syncAnalystUI = () => {
    const { name, role, initial } = getActiveAnalyst();
    const avatar = $("analyst-avatar-badge");
    if (avatar) avatar.textContent = initial;
    const roleEl = $("active-analyst-role");
    if (roleEl) roleEl.textContent = role;
  };
  syncAnalystUI();
  analystSel.addEventListener("change", () => {
    try { localStorage.setItem("panopticon.analyst", analystSel.value); } catch {}
    syncAnalystUI();
    const { name } = getActiveAnalyst();
    showToast(`Active analyst set to ${name}`);
  });
}

for (const t of ["summary", "evidence", "tree", "response"]) {
  const btn = $(`tab-btn-${t}`);
  if (btn) btn.addEventListener("click", () => switchDrawerTab(t));
}

const gotoResp = $("btn-goto-response");
if (gotoResp) gotoResp.addEventListener("click", () => switchDrawerTab("response"));

const btnCopyId = $("btn-copy-id");
if (btnCopyId) {
  btnCopyId.addEventListener("click", () => {
    if (currentAlert && currentAlert.alert_id) {
      copyToClipboard(currentAlert.alert_id, "Alert ID");
    }
  });
}

const btnCopyEv = $("btn-copy-evidence");
if (btnCopyEv) {
  btnCopyEv.addEventListener("click", () => {
    if (currentAlert) copyToClipboard(JSON.stringify(evidenceOf(currentAlert), null, 2), "Evidence JSON");
  });
}

const btnToggleJson = $("btn-toggle-json");
if (btnToggleJson) {
  btnToggleJson.addEventListener("click", () => {
    const raw = $("raw-evidence");
    const grid = $("evidence");
    if (!raw || !grid) return;
    const isShowingRaw = !raw.hidden;
    raw.hidden = isShowingRaw;
    grid.hidden = !isShowingRaw;
    btnToggleJson.textContent = isShowingRaw ? "View Raw JSON" : "View Structured Grid";
  });
}

const modalReason = $("modal-reason");
if (modalReason) modalReason.addEventListener("input", updateModalButtonState);
const modalHost = $("modal-host-input");
if (modalHost) modalHost.addEventListener("input", updateModalButtonState);

const btnCancelModal = $("btn-cancel-modal");
if (btnCancelModal) btnCancelModal.addEventListener("click", () => {
  const modal = $("modal-response");
  if (modal) modal.close();
});

const closeModalResp = $("close-modal-response");
if (closeModalResp) closeModalResp.addEventListener("click", () => {
  const modal = $("modal-response");
  if (modal) modal.close();
});

const btnConfirmModal = $("btn-confirm-modal");
if (btnConfirmModal) btnConfirmModal.addEventListener("click", () => {
  if (!pendingResponseAction) return;
  const reason = ($("modal-reason").value || "").trim();
  const analyst = getActiveAnalyst();
  const isReject = pendingResponseAction.actionType === "REJECT_ACTION";
  const actionStatus = isReject ? "REJECTED" : "DISPATCHED";

  // Record into immutable session audit log
  const auditEntry = {
    actionId: "ACT-" + Date.now().toString(36).toUpperCase(),
    actionType: pendingResponseAction.actionType,
    target: `${pendingResponseAction.targetHost} (${pendingResponseAction.targetDesc})`,
    status: actionStatus,
    analyst: `${analyst.name} (${analyst.role})`,
    reason: reason,
    time: new Date().toLocaleTimeString()
  };
  sessionAuditLog.unshift(auditEntry);
  renderAuditLog();

  showToast(`${actionStatus}: ${pendingResponseAction.actionType} for ${pendingResponseAction.targetHost} · Signed by ${analyst.name}`, 4000);
  const modal = $("modal-response");
  if (modal) modal.close();
  switchDrawerTab("response");

  const container = $("drawer-response-cards");
  if (container) {
    const statusNotice = node("div", undefined, "action-card action-card-dispatched");
    statusNotice.append(
      node("strong", `✓ ${pendingResponseAction.actionType} ${actionStatus}`),
      node("span", `Status: ${actionStatus} · Authorizing Officer: ${analyst.name} (${analyst.role}) · Reason: ${reason}`, "mono-tag")
    );
    container.prepend(statusNotice);
  }
});

const densityBtn = $("btn-density");
if (densityBtn) {
  try {
    const saved = localStorage.getItem("panopticon.density");
    if (saved === "compact") {
      document.documentElement.dataset.density = "compact";
      densityBtn.textContent = "Density: Compact";
    }
  } catch {}
  densityBtn.addEventListener("click", () => {
    const isCompact = document.documentElement.dataset.density === "compact";
    const next = isCompact ? "comfortable" : "compact";
    document.documentElement.dataset.density = next;
    try { localStorage.setItem("panopticon.density", next); } catch {}
    densityBtn.textContent = `Density: ${next === "compact" ? "Compact" : "Comfortable"}`;
    showToast(`Table density set to ${next}`);
  });
}

// ============================================================================
// SLIDE-BASED NAVIGATION ENGINE (Milestone 3 — R3)
// ============================================================================
const SLIDES = [
  { id: "panel-overview", hash: "#overview", title: "Overview / Posture" },
  { id: "panel-endpoints", hash: "#endpoints", title: "Endpoint Fleet & Health" },
  { id: "panel-alerts", hash: "#alerts", title: "Detections & Alerts" },
  { id: "panel-response", hash: "#response", title: "Response Action Queue & Audit" }
];
let currentSlide = 0;

function getSlideIndexFromHash(hash) {
  if (!hash || typeof hash !== "string") return Math.max(0, 0);
  const clean = hash.replace(/^#/, "").toLowerCase().trim();
  if (clean === "overview" || clean === "panel-overview") return 0;
  if (clean === "endpoints" || clean === "panel-endpoints" || clean === "top-assets-panel") return 1;
  if (clean === "alerts" || clean === "panel-alerts") return 2;
  if (clean === "response" || clean === "panel-response") return 3;
  return Math.max(0, 0);
}

function goToSlide(targetIndex) {
  const nextIndex = Math.max(0, Math.min(3, Math.min(SLIDES.length - 1, targetIndex)));
  currentSlide = nextIndex;

  const slideTrack = $("slide-track");
  if (slideTrack) {
    if (!slideTrack.style) slideTrack.style = {};
    slideTrack.style.transform = "translateX(-" + (nextIndex * 25) + "%)";
  }

  const btnPrev = $("btn-slide-prev");
  if (btnPrev) {
    btnPrev.disabled = (nextIndex <= 0);
  }

  const btnNext = $("btn-slide-next");
  if (btnNext) {
    btnNext.disabled = (nextIndex >= 3 || nextIndex >= SLIDES.length - 1);
  }

  const indicator = $("slide-indicator");
  if (indicator) {
    indicator.textContent = "Slide " + (nextIndex + 1) + " of 4: " + SLIDES[nextIndex].title;
  }

  // Synchronize sidebar links active state
  const targetHash = SLIDES[nextIndex].hash;
  const targetId = SLIDES[nextIndex].id;
  document.querySelectorAll("nav a").forEach((item) => {
    const href = item.getAttribute ? item.getAttribute("href") : "";
    if (href === targetHash || href === "#" + targetId || (nextIndex === 1 && href === "#top-assets-panel")) {
      item.classList.add("active");
    } else if (href && ["#overview", "#endpoints", "#alerts", "#response", "#panel-overview", "#panel-endpoints", "#panel-alerts", "#panel-response", "#top-assets-panel"].some((h) => href === h)) {
      item.classList.remove("active");
    }
  });

  // Synchronize subnav tabs active state
  document.querySelectorAll(".subnav-tab").forEach((tab) => {
    const href = tab.getAttribute ? tab.getAttribute("href") : "";
    if (href === targetHash || href === "#" + targetId || (nextIndex === 1 && href === "#top-assets-panel")) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  // Synchronize URL hash with history.replaceState
  if (typeof window !== "undefined" && window.location) {
    if (window.location.hash !== targetHash) {
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(null, "", targetHash);
      } else {
        window.location.hash = targetHash;
      }
    }
  }
}

// Next / Previous button event listeners
const btnPrevEl = $("btn-slide-prev");
if (btnPrevEl) {
  btnPrevEl.addEventListener("click", () => goToSlide(currentSlide - 1));
}
const btnNextEl = $("btn-slide-next");
if (btnNextEl) {
  btnNextEl.addEventListener("click", () => goToSlide(currentSlide + 1));
}

// Unified Keyboard listener for slide transitions, shortcuts, and modal management
document.addEventListener("keydown", (e) => {
  if (!e || !e.key) return;
  if (e.key === "Escape") {
    const modal = $("modal-response");
    if (modal && modal.open) {
      modal.close();
      return;
    }
    const detail = $("detail");
    if (detail && detail.open) {
      detail.close();
      document.querySelectorAll("tr.selected-row").forEach((r) => r.classList.remove("selected-row"));
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    if (e.preventDefault) e.preventDefault();
    const search = $("search");
    if (search && search.focus) search.focus();
    return;
  }

  // Ignore navigation arrow keys if user is typing or if any modal/dialog is open
  const activeEl = document.activeElement;
  const tag = (activeEl && activeEl.tagName) ? activeEl.tagName.toUpperCase() : "";
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (activeEl && activeEl.isContentEditable)) {
    return;
  }
  const modalResp = $("modal-response");
  if (modalResp && modalResp.open) return;
  const detailDialog = $("detail");
  if (detailDialog && detailDialog.open) return;

  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    if (e.preventDefault) e.preventDefault();
    goToSlide(currentSlide + 1);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    if (e.preventDefault) e.preventDefault();
    goToSlide(currentSlide - 1);
  }
});

// Sidebar & Subnav Navigation Click Listeners
function bindNavSlideLinks() {
  const allNavLinks = Array.from(document.querySelectorAll("nav a, .subnav-tab"));
  allNavLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute ? link.getAttribute("href") : "";
      if (!href || !href.startsWith("#")) return;
      const clean = href.replace(/^#/, "").toLowerCase();
      if (["overview", "endpoints", "alerts", "response", "panel-overview", "panel-endpoints", "panel-alerts", "panel-response", "top-assets-panel"].includes(clean)) {
        if (e && e.preventDefault) e.preventDefault();
        const targetIndex = getSlideIndexFromHash(href);
        goToSlide(targetIndex);
      }
    });
  });
}
bindNavSlideLinks();

// Initial slide position from URL hash on page load
const initialHash = (typeof window !== "undefined" && window.location && window.location.hash) ? window.location.hash : "";
goToSlide(getSlideIndexFromHash(initialHash));

// Window hashchange listener for browser forward/back navigation
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("hashchange", () => {
    if (window.location && window.location.hash) {
      goToSlide(getSlideIndexFromHash(window.location.hash));
    }
  });
}


renderAuditLog();
poll();
setInterval(poll, POLL_INTERVAL_MS);

});


// RESPONSE ACTIONS PANEL
// Read-only. Calls this console's own same-origin /api/response-actions
// route only -- never Manager directly, so the page's CSP (connect-src
// 'self') stays untouched and no analyst credential ever needs to reach
// browser JavaScript. The console's own server attaches the Manager token
// server-side (see app.py's fetch_response_actions) when --manager-url and
// PANOPTICON_MANAGER_TOKEN are configured; if they aren't, this route
// answers 503 and the panel simply shows "unavailable". Authorizing or
// rejecting a response action is intentionally not offered here -- that
// stays a direct analyst action against Manager.
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function text(v) { return v == null ? "—" : String(v); }
  function node(tag, value, cls) {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = text(value);
    if (cls) el.className = cls;
    return el;
  }

  function formatTarget(target) {
    if (!target || typeof target !== "object") return "—";
    const pid = target.target_pid || target.pid;
    const host = target.host_id;
    const path = target.path || target.file_path;
    if (host && pid) return "host " + host + " · pid " + pid;
    if (pid) return "pid " + pid;
    if (host && path) return "host " + host + " · path " + path;
    if (path) return "path " + path;
    if (host) return "host " + host;
    return "—";
  }

  function formatCommandExecution(action) {
    if (!action.command_id || !action.command_state) {
      return "No command issued";
    }
    if (action.command_state === "SUCCEEDED") {
      const tgt = formatTarget(action.target);
      const tgtPart = (tgt && tgt !== "—") ? ` (${tgt})` : "";
      return `Agent reported SUCCEEDED for ${action.action}${tgtPart} · command ${action.command_id}`;
    }
    if (action.command_state === "DISPATCHED") {
      return `${action.action} is DISPATCHED · no outcome reported yet`;
    }
    if (action.command_state === "FAILED") {
      return `Agent reported FAILED for ${action.action} · command ${action.command_id}`;
    }
    return `Command ${action.command_id} (${action.command_state})`;
  }

  function rowFor(action) {
    const row = node("tr");

    // 0: State
    const stateStr = text(action.lifecycle_state || "PENDING");
    const c0 = node("td", stateStr);
    const badge0 = node("span", stateStr, "badge badge-" + stateStr.toLowerCase());
    c0.append(badge0);

    // 1: Action & Target
    const c1 = node("td");
    const actName = node("div", action.action, "action-name");
    const tgtText = formatTarget(action.target);
    const tgtSub = node("div", tgtText, "action-target");
    c1.append(actName, tgtSub);

    // 2: Tier
    const tierStr = text(action.tier || "ANALYST_APPROVAL");
    const c2 = node("td", tierStr);
    const badgeTier = node("span", tierStr, "badge-tier");
    c2.append(badgeTier);

    // 3: Alert ID
    const c3 = node("td", action.alert_id);

    // 4: Created At
    const c4 = node("td", action.created_at);

    // 5: Decided Reason
    const c5 = node("td", action.decided_reason);

    // 6: Command Execution
    const c6 = node("td", formatCommandExecution(action));

    // 7: Audit Trail
    const c7 = node("td");
    if (Array.isArray(action.audit) && action.audit.length > 0) {
      const details = node("details", undefined, "response-audit-details");
      const summary = node("summary", `${action.audit.length} audit events`);
      const list = node("ul", undefined, "audit-events-list");
      for (const item of action.audit) {
        const itemText = `${item.event || "event"} · by ${item.actor || "unknown"} · ${item.detail || ""}`;
        list.append(node("li", itemText));
      }
      details.append(summary, list);
      c7.append(details);
    } else {
      c7.append(node("span", "No audit events", "text-muted"));
    }

    // 8: Decision Controls
    const c8 = node("td");
    if (action.lifecycle_state === "PENDING") {
      const btnAuth = node("button", "Authorize", "btn-sm btn-primary btn-authorize");
      const btnRej = node("button", "Reject", "btn-sm btn-danger btn-reject");

      btnAuth.addEventListener("click", async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        btnAuth.disabled = true;
        btnRej.disabled = true;
        btnAuth.textContent = "Authorizing...";
        try {
          const res = await fetch(`/api/response-actions/${encodeURIComponent(action.response_id)}/authorize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          if (res.ok) {
            lastPayloadString = null;
            await pollResponseActions();
          } else {
            const err = await res.json().catch(() => ({}));
            if (typeof alert === "function") alert("Failed to authorize: " + (err.error || res.statusText));
            btnAuth.disabled = false;
            btnRej.disabled = false;
            btnAuth.textContent = "Authorize";
          }
        } catch (ex) {
          if (typeof alert === "function") alert("Network error: " + ex.message);
          btnAuth.disabled = false;
          btnRej.disabled = false;
          btnAuth.textContent = "Authorize";
        }
      });

      btnRej.addEventListener("click", async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const reason = (typeof prompt === "function") ? prompt("Enter rejection reason (required):") : "Analyst dismissed";
        if (!reason || !reason.trim()) {
          return;
        }
        btnAuth.disabled = true;
        btnRej.disabled = true;
        btnRej.textContent = "Rejecting...";
        try {
          const res = await fetch(`/api/response-actions/${encodeURIComponent(action.response_id)}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() })
          });
          if (res.ok) {
            lastPayloadString = null;
            await pollResponseActions();
          } else {
            const err = await res.json().catch(() => ({}));
            if (typeof alert === "function") alert("Failed to reject: " + (err.error || res.statusText));
            btnAuth.disabled = false;
            btnRej.disabled = false;
            btnRej.textContent = "Reject";
          }
        } catch (ex) {
          if (typeof alert === "function") alert("Network error: " + ex.message);
          btnAuth.disabled = false;
          btnRej.disabled = false;
          btnRej.textContent = "Reject";
        }
      });

      c8.append(btnAuth, btnRej);
    }

    row.append(c0, c1, c2, c3, c4, c5, c6, c7, c8);
    return row;
  }

  let lastPayloadString = null;

  async function pollResponseActions() {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/response-actions", { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastPayloadString = null;
        $("response-table").hidden = true; $("response-empty").hidden = false;
        $("response-empty-title").textContent = response.status === 503 ? "Response actions unavailable" : "Cannot load response actions";
        $("response-empty-description").textContent = text(payload.error || payload.detail || "Manager did not return response actions.");
        $("response-status").textContent = "Not connected";
        return;
      }

      const payloadStr = JSON.stringify(payload);
      if (payloadStr === lastPayloadString) {
        return;
      }
      lastPayloadString = payloadStr;

      const actions = Array.isArray(payload.response_actions) ? payload.response_actions : [];
      const fragment = document.createDocumentFragment();
      for (const action of actions) fragment.append(rowFor(action));
      $("response-body").replaceChildren(fragment);
      $("response-table").hidden = !actions.length;
      $("response-empty").hidden = !!actions.length;
      $("response-empty-title").textContent = "No response actions yet";
      $("response-empty-description").textContent = "Response actions appear here when a detection recommends one.";
      $("response-status").textContent = "Connected · updated " + new Date().toLocaleTimeString();
    } catch {
      lastPayloadString = null;
      $("response-status").textContent = "Cannot reach the console server";
    } finally { clearTimeout(timeout); }
  }
  $("response-refresh").addEventListener("click", pollResponseActions);
  pollResponseActions();
  setInterval(pollResponseActions, 3000);
});

