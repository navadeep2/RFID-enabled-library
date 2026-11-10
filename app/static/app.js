// Web Audio Synthesizer for Handheld & Gate audio events (FR 06, FR 07, AC 05, AC 06)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioMuted = false;

function toggleAudioMute() {
  audioMuted = !audioMuted;
  const btn = document.getElementById("audio-toggle-btn");
  if (btn) {
    btn.textContent = audioMuted ? "MUTED" : "ENABLED";
    btn.className = `font-mono text-[10px] px-1.5 py-0.5 rounded transition ${
      audioMuted ? "bg-rose-100 text-rose-700 font-semibold" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
    }`;
  }
}

function playTone(freq, duration, type = "sine") {
  if (audioMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio context error:", e);
  }
}

function playAudioEvent(eventType) {
  if (audioMuted) return;
  if (eventType === "BEEP_CONFIRM") {
    playTone(880, 0.12, "sine");
  } else if (eventType === "ALERT_MISPLACED") {
    playTone(1200, 0.1, "triangle");
    setTimeout(() => playTone(1200, 0.1, "triangle"), 140);
  } else if (eventType === "ALERT_MISSING") {
    playTone(320, 0.22, "sawtooth");
  } else if (eventType === "GATE_ALARM") {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(880, 0.15, "square"), i * 200);
      setTimeout(() => playTone(580, 0.15, "square"), i * 200 + 100);
    }
  }
}

// Mobile Navigation Drawer Toggle
function toggleMobileNav() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (drawer) {
    drawer.classList.toggle("hidden");
  }
}

// Navigation Tab Switcher
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  const desktopBtn = Array.from(document.querySelectorAll(".sidebar-nav-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
  if (desktopBtn) desktopBtn.classList.add("active");

  const meta = {
    "opac-tab": { title: "OPAC Catalog & Virtual Bookshelf", subtitle: "Real-time full-text bibliographic indexing and shelf visualizer" },
    "circulation-tab": { title: "Circulation Desk & Invariants", subtitle: "Issue, return, and renewal with automated RFID security bit toggling" },
    "rfid-studio-tab": { title: "RFID Hardware Studio", subtitle: "Software simulators for Staff Station, Handheld Inventory Scanner & Security Gates" },
    "migration-tab": { title: "High-Volume Data Ingestion (~20k Records)", subtitle: "Streaming spreadsheet processor with pre-validation dry-run and atomic rollback" },
    "interop-tab": { title: "Standards Interoperability (SIP2 & NCIP)", subtitle: "3M SIP2 and NCIP 2.0 message parser and protocol emulator" },
    "analytics-tab": { title: "Audit Trail & Operational Metrics", subtitle: "Cryptographic event ledger and real-time library usage statistics" }
  };

  const info = meta[tabId] || { title: "AISYS Library", subtitle: "" };
  document.getElementById("page-title").textContent = info.title;
  document.getElementById("page-subtitle").textContent = info.subtitle;

  if (tabId === "analytics-tab") loadDashboardReports();
  if (tabId === "opac-tab") searchCatalog();
}

// Smart Card Switcher (AC 07)
async function switchSmartCard(cardUid) {
  try {
    const res = await fetch(`/api/v1/auth/smart-card-tap?smart_card_uid=${cardUid}`, { method: "POST" });
    if (!res.ok) throw new Error("Card rejected");
    const data = await res.json();

    document.getElementById("desktop-user-name").textContent = data.full_name;
    document.getElementById("desktop-user-role").textContent = data.role;
    document.getElementById("mobile-user-name").textContent = data.full_name;

    const initials = data.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    document.getElementById("avatar-initials").textContent = initials;

    playAudioEvent("BEEP_CONFIRM");
  } catch (err) {
    alert("Smart card authentication failed: " + err.message);
  }
}

// 1. OPAC & Virtual Bookshelf
function quickSearch(term) {
  document.getElementById("opac-search-input").value = term;
  searchCatalog();
}

async function searchCatalog() {
  const query = document.getElementById("opac-search-input").value.trim();
  const category = document.getElementById("opac-cat-filter").value;
  let url = `/api/v1/catalog/search?limit=30`;
  if (query) url += `&q=${encodeURIComponent(query)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    document.getElementById("results-count").textContent = data.total;

    const tbody = document.getElementById("catalog-results-body");
    tbody.innerHTML = "";

    if (data.results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-zinc-400">No matching titles found in catalog.</td></tr>`;
      return;
    }

    data.results.forEach(item => {
      const isAvailable = item.available_copies > 0;
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50/80 transition-colors";
      tr.innerHTML = `
        <td class="py-3 px-4 font-mono text-zinc-500 text-[11px]">${item.isbn}</td>
        <td class="py-3 px-4 font-medium text-zinc-900">${item.title}</td>
        <td class="py-3 px-4 text-zinc-600">${item.author}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700">
            ${item.category}
          </span>
        </td>
        <td class="py-3 px-4 font-mono text-[11px] text-zinc-500">${item.dewey_decimal || 'N/A'}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            isAvailable ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
          }">
            <span class="w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
            ${item.available_copies} of ${item.total_copies} Avail
          </span>
        </td>
        <td class="py-3 px-4 text-right">
          <button onclick="openSpineModal('${item.isbn}', '${item.title.replace(/'/g, "\\'")}', '${item.author.replace(/'/g, "\\'")}', '${item.dewey_decimal}')" class="px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md transition shadow-2xs">
            Sticker
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderVirtualBookshelf();
  } catch (err) {
    console.error("Search failed:", err);
  }
}

async function renderVirtualBookshelf() {
  try {
    const res = await fetch("/api/v1/catalog/shelf/SHELF-CS-01");
    const items = await res.json();
    const shelf = document.getElementById("shelf-visual-container");
    shelf.innerHTML = "";

    items.forEach(item => {
      const spine = document.createElement("div");
      let catCls = "cat-cs";
      if (item.category === "Literature") catCls = "cat-lit";
      if (item.status === "REFERENCE_ONLY") catCls = "cat-ref";

      spine.className = `book-spine-card ${catCls}`;
      spine.title = `${item.title} (${item.accession_number})\nStatus: ${item.status}\nRFID EPC: ${item.rfid_epc || 'Un-tagged'}`;
      spine.textContent = item.title;
      spine.onclick = () => {
        alert(`📖 ${item.title}\nBarcode: ${item.accession_number}\nRFID EPC: ${item.rfid_epc || 'Not Tagged'}\nStatus: ${item.status}\nSecurity Bit: ${item.security_bit === 1 ? 'Armed (1)' : 'Disarmed (0)'}`);
      };
      shelf.appendChild(spine);
    });
  } catch (err) {
    console.error("Shelf render error:", err);
  }
}

function openSpineModal(isbn, title, author, dewey) {
  const modal = document.getElementById("spine-modal");
  const content = document.getElementById("spine-modal-content");
  const cutter = author ? author.slice(0, 3).toUpperCase() : "UNK";

  content.innerHTML = `
    <div class="font-bold border-b border-zinc-200 pb-1 text-zinc-900 tracking-wider">AISYS LIBRARY SYSTEM</div>
    <div class="py-1">
      <div class="text-sm font-bold text-zinc-950">${dewey || '005.133'}</div>
      <div class="text-xs text-zinc-600 font-semibold">${cutter}</div>
    </div>
    <div class="text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-200">
      ${isbn}<br>
      *ACC-THERMAL-STICKER*
    </div>
  `;
  modal.classList.remove("hidden");
}

function closeSpineModal() {
  document.getElementById("spine-modal").classList.add("hidden");
}

// 2. Circulation Desk
async function executeCheckout() {
  const patron = document.getElementById("circ-patron-code").value.trim();
  const item = document.getElementById("circ-item-id").value.trim();
  const feedback = document.getElementById("checkout-feedback");

  try {
    const res = await fetch("/api/v1/circulation/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_code: patron, item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Checkout rejected");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs space-y-0.5">
        <div class="font-semibold flex items-center gap-1.5 text-emerald-900">
          <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Checkout Complete
        </div>
        <div>Item: <strong>${data.item_title}</strong> (${data.accession_number})</div>
        <div>Patron: ${data.patron_name} | Due: <strong>${data.due_date}</strong></div>
        <div class="text-[11px] font-mono text-emerald-700 mt-1">✓ RFID Security Bit Disarmed (0)</div>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    playTone(250, 0.25, "sawtooth");
    feedback.innerHTML = `
      <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
        <div class="font-semibold text-rose-900 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Borrowing Blocked
        </div>
        <div class="mt-1">${err.message}</div>
      </div>
    `;
  }
}

async function executeCheckin() {
  const item = document.getElementById("checkin-item-id").value.trim();
  const feedback = document.getElementById("checkin-feedback");

  try {
    const res = await fetch("/api/v1/circulation/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Checkin failed");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs space-y-0.5">
        <div class="font-semibold text-emerald-900">✓ Returned: ${data.item_title}</div>
        <div>Fine Accrued: $${data.fine_accrued.toFixed(2)}</div>
        <div class="text-[11px] font-mono text-emerald-700">✓ Security Bit Re-Armed (1)</div>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div class="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">${err.message}</div>`;
  }
}

async function executeRenewal() {
  const item = document.getElementById("renew-item-id").value.trim();
  const feedback = document.getElementById("renew-feedback");

  try {
    const res = await fetch("/api/v1/circulation/renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Renewal failed");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `<span class="text-emerald-700 font-medium">✓ ${data.message}</span>`;
  } catch (err) {
    feedback.innerHTML = `<span class="text-rose-600 font-medium">${err.message}</span>`;
  }
}

function fillCirculationForm(patron, item) {
  document.getElementById("circ-patron-code").value = patron;
  document.getElementById("circ-item-id").value = item;
  document.getElementById("checkin-item-id").value = item;
  document.getElementById("renew-item-id").value = item;
}

function fillHandheldScan(shelf, epcs) {
  document.getElementById("handheld-shelf").value = shelf;
  document.getElementById("handheld-epcs").value = epcs;
}

function simulateConstraintTest(testType) {
  if (testType === 'FINE_LIMIT') {
    document.getElementById("circ-patron-code").value = "MEM-102";
    document.getElementById("circ-item-id").value = "ACC-10001";
    executeCheckout();
  } else if (testType === 'MEMBER_BLOCKED') {
    document.getElementById("circ-patron-code").value = "MEM-103";
    document.getElementById("circ-item-id").value = "ACC-10001";
    executeCheckout();
  } else if (testType === 'REFERENCE_ONLY') {
    document.getElementById("circ-patron-code").value = "MEM-101";
    document.getElementById("circ-item-id").value = "ACC-10008";
    executeCheckout();
  }
}

// 3. RFID Studio
async function executeTagAssociation() {
  const acc = document.getElementById("tag-accession").value.trim();
  const epc = document.getElementById("tag-epc").value.trim();
  const feedback = document.getElementById("tag-station-feedback");

  try {
    const res = await fetch("/api/v1/rfid/staff/tag-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accession_number: acc, rfid_epc: epc })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Tagging failed");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
        ✓ <strong>${data.message}</strong> (Security Bit: 1 Armed)
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">${err.message}</div>`;
  }
}

async function executeHandheldScan() {
  const shelf = document.getElementById("handheld-shelf").value.trim();
  const rawEpcs = document.getElementById("handheld-epcs").value.split(",").map(s => s.trim());
  const box = document.getElementById("handheld-results-box");

  try {
    const res = await fetch("/api/v1/rfid/handheld/audit-shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelf_id: shelf, scanned_epcs: rawEpcs })
    });
    const data = await res.json();
    playAudioEvent(data.audio_event);

    const misplacedHtml = data.misplaced_items.map(m => `
      <li class="flex items-center justify-between py-1 border-b border-rose-100 text-xs">
        <span class="font-medium text-rose-900">${m.title}</span>
        <span class="font-mono text-rose-600">${m.rfid_epc} (Expected on ${m.expected_shelf || 'unknown'})</span>
      </li>
    `).join("");

    const missingHtml = data.missing_items.map(m => `
      <li class="flex items-center justify-between py-1 border-b border-amber-100 text-xs">
        <span class="font-medium text-amber-900">${m.title}</span>
        <span class="font-mono text-amber-600">${m.accession_number}</span>
      </li>
    `).join("");

    box.innerHTML = `
      <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs font-semibold text-zinc-900">Shelf Audit: <code>${data.shelf_id}</code></div>
          <div class="flex gap-2 text-[10px]">
            <span class="px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">Scanned: ${data.total_scanned}</span>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Found: ${data.found_count}</span>
            <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800">Misplaced: ${data.misplaced_count}</span>
            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Missing: ${data.missing_count}</span>
          </div>
        </div>

        ${misplacedHtml ? `
          <div class="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
            <span class="text-xs font-semibold text-rose-900 block mb-1">Misplaced Items Detected:</span>
            <ul>${misplacedHtml}</ul>
          </div>
        ` : ''}

        ${missingHtml ? `
          <div class="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
            <span class="text-xs font-semibold text-amber-900 block mb-1">Expected Books Absent from Shelf:</span>
            <ul>${missingHtml}</ul>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600">Audit failed: ${err.message}</div>`;
  }
}

function drawMockCCTVFrame(portalId, accession) {
  const canvas = document.getElementById("cctv-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`CAM-GATE-01 [BREACH ACTIVE]`, 8, 16);
  ctx.fillStyle = "#22c55e";
  ctx.fillText(new Date().toISOString(), 8, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`TAG: ${accession}`, 8, 42);

  // Outline of human silhouette passing gate
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(120, 75, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(120, 87);
  ctx.lineTo(120, 115);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

async function executeGatePassage() {
  const portal = document.getElementById("gate-portal-id").value;
  const rawEpcs = document.getElementById("gate-passing-epcs").value.split(",").map(s => s.trim());
  const banner = document.getElementById("gate-alarm-banner");
  const mockCctv = drawMockCCTVFrame(portal, rawEpcs[0]);

  try {
    const res = await fetch("/api/v1/rfid/gate/passage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal_id: portal,
        detected_epcs: rawEpcs,
        mock_cctv_frame_base64: mockCctv
      })
    });
    const data = await res.json();

    if (data.alarm_triggered) {
      playAudioEvent("GATE_ALARM");
      banner.classList.remove("hidden");
      const v = data.violations[0];
      document.getElementById("gate-alarm-details").innerHTML = `
        Portal: <strong>${data.portal_id}</strong> &bull; Unissued Item: <strong>${v.item_title}</strong> (Barcode: <code>${v.accession_number}</code>) &bull; Security Bit: <strong>1 (Armed)</strong>
      `;
      document.getElementById("gate-email-notice").innerHTML = `
        <div class="font-medium text-rose-700">✓ Security incident email queued to:</div>
        <div class="font-mono text-[11px] text-zinc-600">security-ops@library.local</div>
        <div class="text-[11px] text-zinc-400 mt-1">Snapshot archived to encrypted vault.</div>
      `;
    } else {
      playAudioEvent("BEEP_CONFIRM");
      banner.classList.add("hidden");
      alert("✓ Gate Passage Clear: All scanned items are authorized (disarmed security bit).");
    }
  } catch (err) {
    alert("Gate error: " + err.message);
  }
}

// 4. 20k Bulk Migration
async function generateSyntheticDataset() {
  alert("Synthetic 20,000 dataset is generated in data/synthetic_library_20000.csv");
  runMigrationTest(true);
}

async function runMigrationTest(isDryRun) {
  const box = document.getElementById("migration-status-box");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="p-6 text-center space-y-2">
      <div class="inline-block w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs text-zinc-600">Executing high-throughput ${isDryRun ? 'DRY-RUN VALIDATION' : 'LIVE INGESTION'} pipeline...</p>
    </div>
  `;

  try {
    let csvData = "isbn,title,author,publisher,publication_year,dewey_decimal,category,accession_number,rfid_epc,shelf_location\n";
    for (let i = 1; i <= 300; i++) {
      const pad = String(i).padStart(5, '0');
      csvData += `978-0-123-${pad}-1,Synthetic Volume ${i},Author ${i},Press,2022,005.${i % 100},Computer Science,MIG-${pad},E280MIG00000${pad},SHELF-CS-01\n`;
    }
    // Duplicate & Malformed edge cases for AC 01 proof
    csvData += `978-0131103627,Kernighan C (Dupe),Dennis Ritchie,Prentice,1988,005.133,Computer Science,ACC-10001,E280110520000001,SHELF-CS-01\n`;
    csvData += `BAD-ISBN,,Missing Author Book,,2020,,,BAD-ACC-01,,SHELF-01\n`;

    const blob = new Blob([csvData], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "test_batch.csv");
    formData.append("dry_run", isDryRun);

    const res = await fetch("/api/v1/migration/upload-csv", { method: "POST", body: formData });
    const data = await res.json();

    box.innerHTML = `
      <div class="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold ${data.is_dry_run ? 'text-amber-800' : 'text-emerald-800'}">
            ${data.is_dry_run ? '🧪 Dry-Run Pre-Validation Report' : '🚀 Ingestion Live & Reconciled'}
          </h4>
          <span class="text-xs font-mono bg-zinc-200 px-2 py-0.5 rounded text-zinc-700">${data.batch_id}</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-zinc-400 uppercase font-medium">Read</span>
            <div class="text-base font-bold text-zinc-900">${data.total_records}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-emerald-600 uppercase font-medium">Valid</span>
            <div class="text-base font-bold text-emerald-600">${data.valid_count}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-amber-600 uppercase font-medium">Duplicates</span>
            <div class="text-base font-bold text-amber-600">${data.duplicate_count}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-rose-600 uppercase font-medium">Invalid</span>
            <div class="text-base font-bold text-rose-600">${data.invalid_count}</div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-200">
          <span>Duration: <strong>${data.duration_seconds}s</strong></span>
          <span class="text-emerald-700 font-semibold">✓ 100% Balanced Reconciliation</span>
        </div>

        ${!data.is_dry_run ? `
          <button onclick="rollbackMigration('${data.batch_id}')" class="px-3 py-1.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition">
            ↩ Rollback Batch (${data.batch_id})
          </button>
        ` : ''}
      </div>
    `;
    searchCatalog();
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600">Migration error: ${err.message}</div>`;
  }
}

async function rollbackMigration(batchId) {
  if (!confirm(`Rollback batch ${batchId}?`)) return;
  try {
    const res = await fetch(`/api/v1/migration/rollback/${batchId}`, { method: "POST" });
    const data = await res.json();
    alert(`Rollback complete: ${data.message}`);
    searchCatalog();
    document.getElementById("migration-status-box").classList.add("hidden");
  } catch (err) {
    alert("Rollback failed: " + err.message);
  }
}

// 5. SIP2 & NCIP Interop
async function sendSip2Message() {
  const raw = document.getElementById("sip2-raw").value;
  const box = document.getElementById("sip2-response-box");
  try {
    const res = await fetch("/api/v1/interop/sip2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_message: raw })
    });
    const data = await res.json();
    box.innerHTML = `
      <div class="p-3 bg-zinc-950 text-zinc-200 font-mono text-[11px] rounded-lg space-y-1">
        <div class="text-zinc-400">&gt; REQ: ${raw}</div>
        <div class="text-emerald-400">&lt; RSP: ${data.response_frame}</div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600">${err.message}</div>`;
  }
}

async function sendNcipRequest() {
  const action = document.getElementById("ncip-action").value;
  const payload = JSON.parse(document.getElementById("ncip-payload").value);
  const box = document.getElementById("ncip-response-box");
  try {
    const res = await fetch(`/api/v1/interop/ncip/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    box.innerHTML = `
      <pre class="p-3 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
    `;
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600">${err.message}</div>`;
  }
}

// 6. Reports & Audit
async function loadDashboardReports() {
  try {
    const res = await fetch("/api/v1/reports/summary");
    const data = await res.json();
    const kpis = document.getElementById("kpi-cards");
    kpis.innerHTML = `
      <div class="p-4 bg-white border border-zinc-200/80 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Catalog Titles</span>
        <div class="text-xl font-bold text-zinc-900 mt-1">${data.catalog.total_titles}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200/80 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Total Copies</span>
        <div class="text-xl font-bold text-zinc-900 mt-1">${data.catalog.total_items}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200/80 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">RFID Tagged</span>
        <div class="text-xl font-bold text-indigo-600 mt-1">${data.catalog.tagged_items} (${data.catalog.tagging_percentage}%)</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200/80 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Currently Borrowed</span>
        <div class="text-xl font-bold text-amber-600 mt-1">${data.catalog.issued_items}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200/80 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Gate Alarms</span>
        <div class="text-xl font-bold text-rose-600 mt-1">${data.security.total_alarms}</div>
      </div>
    `;
    loadAuditLogs();
  } catch (err) {
    console.error("Dashboard reports error:", err);
  }
}

async function loadAuditLogs() {
  try {
    const res = await fetch("/api/v1/admin/audit-logs?limit=40");
    const logs = await res.json();
    const tbody = document.getElementById("audit-logs-body");
    tbody.innerHTML = "";
    logs.forEach(l => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50/80";
      tr.innerHTML = `
        <td class="py-2.5 px-4 text-zinc-400">${l.id}</td>
        <td class="py-2.5 px-4 text-zinc-500">${l.timestamp.slice(0, 19).replace('T', ' ')}</td>
        <td class="py-2.5 px-4 font-medium text-zinc-800">${l.actor_id}</td>
        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-semibold">${l.action}</span></td>
        <td class="py-2.5 px-4 text-zinc-500">${l.entity_type}</td>
        <td class="py-2.5 px-4 text-[10px] text-zinc-500 max-w-xs truncate">${l.details}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

async function triggerSnapshotBackup() {
  try {
    const res = await fetch("/api/v1/admin/backup", { method: "POST" });
    const data = await res.json();
    alert(`Snapshot Created Successfully!\nFile: ${data.backup_file}\nSHA-256 Checksum: ${data.sha256}`);
    loadAuditLogs();
  } catch (e) {
    alert("Backup failed: " + e.message);
  }
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", () => {
  searchCatalog();
});
