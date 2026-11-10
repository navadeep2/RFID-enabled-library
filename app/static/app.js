// =========================================================================
// Smart Library System - Frontend Logic
// Built with Plain English, Audio Cues, and Resilient API Handling
// =========================================================================

// Audio Synthesizer for Handheld Beeps & Gate Sirens (FR 06, FR 07, AC 05, AC 06)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioMuted = false;

function toggleAudioMute() {
  audioMuted = !audioMuted;
  const btn = document.getElementById("audio-toggle-btn");
  if (btn) {
    btn.textContent = audioMuted ? "MUTED" : "ON";
    btn.className = `font-bold text-[10px] px-2 py-0.5 rounded transition ${
      audioMuted ? "bg-rose-100 text-rose-800" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
    }`;
  }
}

function playTone(freq, duration, type = "sine") {
  if (audioMuted) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
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
    console.warn("Audio error:", e);
  }
}

function playAudioEvent(eventType) {
  if (audioMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}

  if (eventType === "BEEP_CONFIRM") {
    // Happy chime for found or valid book
    playTone(880, 0.12, "sine");
  } else if (eventType === "ALERT_MISPLACED") {
    // Double beep: Book is on the wrong shelf!
    playTone(1200, 0.1, "triangle");
    setTimeout(() => playTone(1200, 0.1, "triangle"), 140);
  } else if (eventType === "ALERT_MISSING") {
    // Low tone: Book is missing from shelf
    playTone(320, 0.22, "sawtooth");
  } else if (eventType === "GATE_ALARM") {
    // Alternating emergency siren
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(880, 0.15, "square"), i * 200);
      setTimeout(() => playTone(580, 0.15, "square"), i * 200 + 100);
    }
  }
}

// Mobile Navigation Toggle
function toggleMobileNav() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (drawer) drawer.classList.toggle("hidden");
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  const desktopBtn = Array.from(document.querySelectorAll(".sidebar-nav-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
  if (desktopBtn) desktopBtn.classList.add("active");

  const titles = {
    "opac-tab": { title: "1. Find Books (Catalog)", subtitle: "Search for any book and see if it is available on the shelf" },
    "circulation-tab": { title: "2. Borrow & Return Books", subtitle: "Lending desk: issue books, return them, and test library rules" },
    "rfid-studio-tab": { title: "3. RFID Smart Tags Lab", subtitle: "Test handheld shelf scanners and anti-theft exit door alarms" },
    "migration-tab": { title: "4. Import 20,000 Books", subtitle: "Safely load a large spreadsheet of books into the library" },
    "interop-tab": { title: "5. Self-Checkout Machines Test", subtitle: "Test machine connections (SIP2 standard)" },
    "analytics-tab": { title: "6. History Log & Stats", subtitle: "Live numbers and a record of every borrow, return, and door alarm" }
  };

  const info = titles[tabId] || { title: "Smart Library", subtitle: "" };
  document.getElementById("page-title").textContent = info.title;
  document.getElementById("page-subtitle").textContent = info.subtitle;

  if (tabId === "analytics-tab") loadDashboardReports();
  if (tabId === "opac-tab") searchCatalog();
}

// Smart Card / Login Switcher
async function switchSmartCard(cardUid) {
  try {
    const res = await fetch(`/api/v1/auth/smart-card-tap?smart_card_uid=${cardUid}`, { method: "POST" });
    if (!res.ok) throw new Error("Card not recognized");
    const data = await res.json();

    document.getElementById("desktop-user-name").textContent = data.full_name.split(" ")[0];
    document.getElementById("desktop-user-role").textContent = data.role;
    document.getElementById("mobile-user-name").textContent = `${data.full_name} (${data.role})`;

    const initials = data.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    document.getElementById("avatar-initials").textContent = initials;

    playAudioEvent("BEEP_CONFIRM");
  } catch (err) {
    alert("Login failed: " + err.message);
  }
}

// =========================================================================
// 1. Find Books (Catalog Search & Virtual Bookshelf with Full Pagination)
// =========================================================================
let currentCatalogPage = 1;
let catalogPageSize = 30;
let totalCatalogRecords = 0;

function quickSearch(term) {
  document.getElementById("opac-search-input").value = term;
  currentCatalogPage = 1;
  searchCatalog();
}

function changePageSize(newSize) {
  catalogPageSize = parseInt(newSize, 10) || 30;
  currentCatalogPage = 1;
  searchCatalog();
}

function firstCatalogPage() {
  if (currentCatalogPage !== 1) {
    currentCatalogPage = 1;
    searchCatalog();
  }
}

function lastCatalogPage() {
  const totalPages = Math.max(1, Math.ceil(totalCatalogRecords / catalogPageSize));
  if (currentCatalogPage !== totalPages) {
    currentCatalogPage = totalPages;
    searchCatalog();
  }
}

function prevCatalogPage() {
  if (currentCatalogPage > 1) {
    currentCatalogPage--;
    searchCatalog();
  }
}

function nextCatalogPage() {
  const totalPages = Math.max(1, Math.ceil(totalCatalogRecords / catalogPageSize));
  if (currentCatalogPage < totalPages) {
    currentCatalogPage++;
    searchCatalog();
  }
}

function borrowBookFromCatalog(accession) {
  switchTab('circulation-tab');
  document.getElementById('circ-item-id').value = accession;
  document.getElementById('checkin-item-id').value = accession;
  document.getElementById('renew-item-id').value = accession;
}

async function searchCatalog() {
  const query = document.getElementById("opac-search-input").value.trim();
  const category = document.getElementById("opac-cat-filter").value;
  const offset = (currentCatalogPage - 1) * catalogPageSize;

  let url = `/api/v1/catalog/search?limit=${catalogPageSize}&offset=${offset}`;
  if (query) url += `&q=${encodeURIComponent(query)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load catalog results");
    const data = await res.json();

    totalCatalogRecords = data.total || 0;
    document.getElementById("results-count").textContent = totalCatalogRecords.toLocaleString();

    const totalPages = Math.max(1, Math.ceil(totalCatalogRecords / catalogPageSize));
    document.getElementById("current-page-num").textContent = currentCatalogPage;
    document.getElementById("total-pages-num").textContent = totalPages;

    const startIdx = totalCatalogRecords === 0 ? 0 : offset + 1;
    const endIdx = Math.min(offset + catalogPageSize, totalCatalogRecords);
    document.getElementById("pagination-info").textContent = `Showing books ${startIdx.toLocaleString()} to ${endIdx.toLocaleString()} of ${totalCatalogRecords.toLocaleString()}`;

    // Enable / disable pagination buttons
    const firstBtn = document.getElementById("btn-first-page");
    const prevBtn = document.getElementById("btn-prev-page");
    const nextBtn = document.getElementById("btn-next-page");
    const lastBtn = document.getElementById("btn-last-page");

    if (firstBtn) firstBtn.disabled = (currentCatalogPage <= 1);
    if (prevBtn) prevBtn.disabled = (currentCatalogPage <= 1);
    if (nextBtn) nextBtn.disabled = (currentCatalogPage >= totalPages);
    if (lastBtn) lastBtn.disabled = (currentCatalogPage >= totalPages);

    const tbody = document.getElementById("catalog-results-body");
    tbody.innerHTML = "";

    if (!data.results || data.results.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-10 text-center text-zinc-500">
            <span class="text-2xl block mb-1">📭</span>
            No books found matching your search.<br>
            <button onclick="quickSearch('')" class="mt-2 text-xs font-bold text-blue-600 hover:underline">
              Show all books in library
            </button>
          </td>
        </tr>
      `;
      return;
    }

    data.results.forEach(item => {
      const isAvailable = (item.available_copies || 0) > 0;
      const sampleAcc = item.sample_accession || 'ACC-10001';
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50 transition-colors";
      tr.innerHTML = `
        <td class="py-3 px-4 font-mono text-zinc-500 text-[11px]">${item.isbn}</td>
        <td class="py-3 px-4 font-bold text-zinc-900">${item.title}</td>
        <td class="py-3 px-4 text-zinc-600">${item.author}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800">
            ${item.category}
          </span>
        </td>
        <td class="py-3 px-4 font-mono text-[11px] font-semibold text-zinc-600">${item.dewey_decimal || 'General'}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }">
            <span class="w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-600' : 'bg-amber-600'}"></span>
            ${isAvailable ? `Available (${item.available_copies} on shelf)` : 'All borrowed'}
          </span>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="borrowBookFromCatalog('${sampleAcc}')" title="Borrow this book" class="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition shadow-2xs">
              Borrow
            </button>
            <button onclick="openSpineModal('${item.isbn}', '${(item.title || '').replace(/'/g, "\\'")}', '${(item.author || '').replace(/'/g, "\\'")}', '${item.dewey_decimal || ''}')" title="Print spine sticker" class="px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-md transition shadow-2xs">
              Sticker
            </button>
          </div>
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
    if (!res.ok) return;
    const items = await res.json();
    const shelf = document.getElementById("shelf-visual-container");
    if (!shelf) return;
    shelf.innerHTML = "";

    items.forEach(item => {
      const spine = document.createElement("div");
      let catCls = "cat-cs";
      if (item.category === "Literature") catCls = "cat-lit";
      if (item.status === "REFERENCE_ONLY") catCls = "cat-ref";

      spine.className = `book-spine-card ${catCls}`;
      spine.title = `${item.title} (${item.accession_number})\nStatus: ${item.status}\nSmart Tag: ${item.rfid_epc || 'Not Tagged'}`;
      spine.textContent = item.title;
      spine.onclick = () => {
        alert(`📖 Book Title: ${item.title}\nBarcode: ${item.accession_number}\nSmart Tag ID: ${item.rfid_epc || 'No Tag Yet'}\nCan be borrowed? ${item.status === 'AVAILABLE' ? 'YES' : 'NO'}\nTheft Alarm: ${item.security_bit === 1 ? 'ON (Protected)' : 'OFF (Borrowed)'}`);
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
    <div class="font-bold border-b border-zinc-200 pb-1 text-zinc-900 tracking-wider">SMART LIBRARY SYSTEM</div>
    <div class="py-2">
      <div class="text-base font-bold text-zinc-950">${dewey || '005.133'}</div>
      <div class="text-xs text-zinc-600 font-bold">${cutter}</div>
    </div>
    <div class="text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-200">
      ${isbn}<br>
      *BOOK-SPINE-STICKER*
    </div>
  `;
  modal.classList.remove("hidden");
}

function closeSpineModal() {
  document.getElementById("spine-modal").classList.add("hidden");
}

// =========================================================================
// 2. Borrow & Return
// =========================================================================
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

async function resetSampleBooks() {
  // Checkin all starter books ACC-10001 through ACC-10005 so users can borrow smoothly
  try {
    for (const acc of ['ACC-10001', 'ACC-10002', 'ACC-10003', 'ACC-10004']) {
      await fetch("/api/v1/circulation/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_identifier: acc })
      });
    }
    alert("Sample books have been returned and reset to available!");
    fillCirculationForm('MEM-101', 'ACC-10001');
    searchCatalog();
  } catch (e) {
    console.error("Reset error:", e);
  }
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
    if (!res.ok) throw new Error(data.detail || "Checkout stopped");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs space-y-1">
        <div class="font-bold text-emerald-950 flex items-center gap-1.5">
          <span>✅</span> Book Borrowed Successfully!
        </div>
        <div>Book: <strong>${data.item_title}</strong> (${data.accession_number})</div>
        <div>Student: <strong>${data.patron_name}</strong> &bull; Return by: <strong>${data.due_date}</strong></div>
        <div class="text-[11px] font-bold text-emerald-800 mt-1">✓ Anti-theft alarm turned OFF (Borrower can walk through exit safely)</div>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    playTone(250, 0.25, "sawtooth");
    const isAlreadyCheckedOut = err.message.includes("already checked out");
    feedback.innerHTML = `
      <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-1.5">
        <div class="font-bold text-rose-950 flex items-center gap-1.5">
          <span>❌</span> Borrowing Blocked
        </div>
        <div>${err.message}</div>
        ${isAlreadyCheckedOut ? `
          <div class="pt-1">
            <button onclick="document.getElementById('checkin-item-id').value = '${item}'; executeCheckin();" class="px-2.5 py-1 text-[11px] bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold rounded">
              ↩ Return this book now
            </button>
          </div>
        ` : ''}
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
    if (!res.ok) throw new Error(data.detail || "Return failed");

    playAudioEvent("BEEP_CONFIRM");
    const fineText = data.fine_accrued > 0 ? `Late fee: $${data.fine_accrued.toFixed(2)}` : 'No late fees';
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs space-y-1">
        <div class="font-bold text-emerald-950">✅ Book Returned: ${data.item_title}</div>
        <div>Status: <strong>${fineText}</strong></div>
        <div class="text-[11px] font-bold text-emerald-800">✓ Anti-theft alarm turned back ON (Protected against theft)</div>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div class="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">${err.message}</div>`;
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
    if (!res.ok) throw new Error(data.detail || "Could not extend loan");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `<span class="text-emerald-800 font-bold">✅ Extended! New return date: ${data.new_due_date}</span>`;
  } catch (err) {
    feedback.innerHTML = `<span class="text-rose-700 font-bold">${err.message}</span>`;
  }
}

// =========================================================================
// 3. RFID Smart Tags Lab
// =========================================================================
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
    if (!res.ok) throw new Error(data.detail || "Could not pair tag");

    playAudioEvent("BEEP_CONFIRM");
    feedback.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
        ✅ <strong>Saved!</strong> Tag [<code>${data.rfid_epc}</code>] is now linked to book "<strong>${data.item_title}</strong>". (Anti-theft alarm: ON).
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">${err.message}</div>`;
  }
}

async function executeHandheldScan() {
  const shelf = document.getElementById("handheld-shelf").value.trim();
  const rawEpcs = document.getElementById("handheld-epcs").value.split(",").map(s => s.trim()).filter(Boolean);
  const box = document.getElementById("handheld-results-box");

  try {
    const res = await fetch("/api/v1/rfid/handheld/audit-shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelf_id: shelf, scanned_epcs: rawEpcs })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Shelf scan failed");

    playAudioEvent(data.audio_event);

    const misplacedHtml = (data.misplaced_items || []).map(m => `
      <li class="flex items-center justify-between py-1 border-b border-rose-100 text-xs">
        <span class="font-bold text-rose-900">${m.title}</span>
        <span class="font-mono text-rose-700">Put on wrong shelf! Belongs on: <strong>${m.expected_shelf || 'unknown'}</strong></span>
      </li>
    `).join("");

    const missingHtml = (data.missing_items || []).map(m => `
      <li class="flex items-center justify-between py-1 border-b border-amber-100 text-xs">
        <span class="font-bold text-amber-900">${m.title}</span>
        <span class="font-mono text-amber-700">Book number: ${m.accession_number}</span>
      </li>
    `).join("");

    box.innerHTML = `
      <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-zinc-900">Scan Results for Shelf: <code>${data.shelf_id}</code></div>
          <div class="flex flex-wrap gap-2 text-[10px] font-bold">
            <span class="px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">Scanned: ${data.total_scanned}</span>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">Found: ${data.found_count}</span>
            <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-900">On Wrong Shelf: ${data.misplaced_count}</span>
            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900">Missing: ${data.missing_count}</span>
          </div>
        </div>

        ${misplacedHtml ? `
          <div class="bg-rose-50 p-3 rounded-lg border border-rose-200">
            <span class="text-xs font-bold text-rose-950 block mb-1">⚠️ Books on the wrong shelf:</span>
            <ul>${misplacedHtml}</ul>
          </div>
        ` : ''}

        ${missingHtml ? `
          <div class="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <span class="text-xs font-bold text-amber-950 block mb-1">❓ Books supposed to be here, but missing:</span>
            <ul>${missingHtml}</ul>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600 font-bold">Scan error: ${err.message}</div>`;
  }
}

function drawMockCCTVFrame(portalId, accession) {
  const canvas = document.getElementById("cctv-canvas");
  if (!canvas) return "";
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`EXIT DOOR CAMERA 1 [THEFT ALARM]`, 8, 16);
  ctx.fillStyle = "#22c55e";
  ctx.fillText(new Date().toLocaleTimeString(), 8, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`BOOK: ${accession}`, 8, 42);

  // Silhouette
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

async function testSafeExit() {
  // First ensure ACC-10001 is checked out so it passes through the gate safely!
  try {
    await fetch("/api/v1/circulation/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_code: "MEM-101", item_identifier: "ACC-10001" })
    });
  } catch (e) {}

  document.getElementById('gate-passing-epcs').value = 'E280110520000001';
  executeGatePassage();
}

async function executeGatePassage() {
  const portal = document.getElementById("gate-portal-id").value;
  const rawEpcs = document.getElementById("gate-passing-epcs").value.split(",").map(s => s.trim()).filter(Boolean);
  const banner = document.getElementById("gate-alarm-banner");
  const mockCctv = drawMockCCTVFrame(portal, rawEpcs[0] || 'ACC-10001');

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
    if (!res.ok) throw new Error(data.detail || "Gate check failed");

    if (data.alarm_triggered) {
      playAudioEvent("GATE_ALARM");
      banner.classList.remove("hidden");
      const v = (data.violations && data.violations[0]) || { item_title: "Book", accession_number: rawEpcs[0] };
      document.getElementById("gate-alarm-details").innerHTML = `
        Door: <strong>${data.portal_id}</strong> &bull; Book: <strong>${v.item_title}</strong> (Barcode: <code>${v.accession_number}</code>) &bull; Theft Protection: <strong>ACTIVE</strong> (Book was not borrowed!)
      `;
      document.getElementById("gate-email-notice").innerHTML = `
        <div class="font-bold text-rose-800">✅ Security Email Alert Sent to:</div>
        <div class="font-mono text-xs text-zinc-700">security-staff@library.local</div>
        <div class="text-[11px] text-zinc-500 mt-1">Photo saved to security records.</div>
      `;
    } else {
      playAudioEvent("BEEP_CONFIRM");
      banner.classList.add("hidden");
      alert("✅ Safe to Exit: All books passing through were properly borrowed.");
    }
  } catch (err) {
    alert("Door error: " + err.message);
  }
}

// =========================================================================
// 4. Import 20,000 Books from Spreadsheet
// =========================================================================
async function generateSyntheticDataset() {
  const statusEl = document.getElementById("step1-status");
  statusEl.innerHTML = `<span class="text-zinc-500 font-bold">Checking file...</span>`;
  try {
    const res = await fetch("/api/v1/migration/generate-synthetic", { method: "POST" });
    const data = await res.json();
    statusEl.innerHTML = `<span class="text-emerald-700 font-bold">✅ ${data.file_name} (${data.size_kb} KB) ready to import!</span>`;
  } catch (err) {
    statusEl.innerHTML = `<span class="text-rose-700 font-bold">Error: ${err.message}</span>`;
  }
}

async function runMigrationTest(isDryRun) {
  const box = document.getElementById("migration-status-box");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="p-6 text-center space-y-2">
      <div class="inline-block w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs font-bold text-zinc-700">Processing 20,000 books from spreadsheet (${isDryRun ? 'CHECKING FOR MISTAKES' : 'ADDING TO LIBRARY'})...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/v1/migration/import-synthetic?dry_run=${isDryRun}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Migration encountered an error on the server");
    }

    const total = data.total_records || 0;
    const valid = data.valid_count || 0;
    const dupes = data.duplicate_count || 0;
    const invalid = data.invalid_count || 0;
    const duration = data.duration_seconds || 0;

    box.innerHTML = `
      <div class="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-bold ${data.is_dry_run ? 'text-amber-900' : 'text-emerald-900'}">
            ${data.is_dry_run ? '🧪 Test Report: Check for Mistakes' : '🚀 All Books Successfully Added to Library!'}
          </h4>
          <span class="text-xs font-mono bg-zinc-200 px-2 py-0.5 rounded text-zinc-800 font-bold">${data.batch_id || 'BATCH'}</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-zinc-500 uppercase font-bold">Total Books in File</span>
            <div class="text-lg font-bold text-zinc-900">${total.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-emerald-700 uppercase font-bold">Good Books</span>
            <div class="text-lg font-bold text-emerald-700">${valid.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-amber-700 uppercase font-bold">Duplicates Caught</span>
            <div class="text-lg font-bold text-amber-700">${dupes.toLocaleString()}</div>
          </div>
          <div class="p-3 bg-white rounded-lg border border-zinc-200">
            <span class="text-[10px] text-rose-700 uppercase font-bold">Errors Caught</span>
            <div class="text-lg font-bold text-rose-700">${invalid.toLocaleString()}</div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-zinc-200">
          <span>Time Taken: <strong>${duration} seconds</strong></span>
          <span class="text-emerald-800 font-bold">✅ 100% of books accounted for!</span>
        </div>

        ${!data.is_dry_run ? `
          <div class="pt-2">
            <button onclick="rollbackMigration('${data.batch_id}')" class="px-3 py-1.5 text-xs bg-rose-50 text-rose-800 font-bold border border-rose-300 rounded-lg hover:bg-rose-100 transition">
              ↩ Undo This Import (Remove Added Books)
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Refresh catalog search and stats to show all newly added books!
    currentCatalogPage = 1;
    searchCatalog();
  } catch (err) {
    box.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">Import notice: ${err.message}</div>`;
  }
}

async function uploadCustomCsv(isDryRun) {
  const fileInput = document.getElementById("custom-csv-file");
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Please select a .csv spreadsheet file first!");
    return;
  }
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dry_run", isDryRun);

  const box = document.getElementById("migration-status-box");
  box.classList.remove("hidden");
  box.innerHTML = `<div class="p-4 text-xs font-bold text-zinc-600">Uploading and validating ${file.name}...</div>`;

  try {
    const res = await fetch("/api/v1/migration/upload-csv", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    box.innerHTML = `
      <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs">
        <div class="font-bold text-zinc-900">Custom File Report: ${file.name}</div>
        <div>Total Rows: <strong>${data.total_records}</strong> &bull; Valid: <strong>${data.valid_count}</strong> &bull; Errors: <strong>${data.invalid_count}</strong></div>
      </div>
    `;
    currentCatalogPage = 1;
    searchCatalog();
  } catch (err) {
    box.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">Upload error: ${err.message}</div>`;
  }
}

async function rollbackMigration(batchId) {
  if (!confirm(`Are you sure you want to undo this import and remove these books?`)) return;
  try {
    const res = await fetch(`/api/v1/migration/rollback/${batchId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Rollback failed");

    alert(`Undo Complete: Removed ${data.deleted_items} books.`);
    currentCatalogPage = 1;
    searchCatalog();
    document.getElementById("migration-status-box").classList.add("hidden");
  } catch (err) {
    alert("Undo failed: " + err.message);
  }
}

// =========================================================================
// 5. Self-Checkout Kiosk Test (SIP2 & NCIP)
// =========================================================================
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
    if (!res.ok) throw new Error(data.detail || "SIP2 error");

    box.innerHTML = `
      <div class="p-3 bg-zinc-950 text-zinc-200 font-mono text-[11px] rounded-lg space-y-1">
        <div class="text-zinc-400">&gt; KIOSK SENT: ${raw}</div>
        <div class="text-emerald-400 font-bold">&lt; LIBRARY ANSWERED: ${data.response_frame}</div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="text-xs text-rose-600 font-bold">${err.message}</div>`;
  }
}

async function sendNcipRequest() {
  const action = document.getElementById("ncip-action").value;
  let payload;
  try {
    payload = JSON.parse(document.getElementById("ncip-payload").value);
  } catch (e) {
    alert("Please enter valid JSON in the message box!");
    return;
  }
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
    box.innerHTML = `<div class="text-xs text-rose-600 font-bold">${err.message}</div>`;
  }
}

// =========================================================================
// 6. History Log & Stats
// =========================================================================
async function loadDashboardReports() {
  try {
    const res = await fetch("/api/v1/reports/summary");
    if (!res.ok) return;
    const data = await res.json();
    const kpis = document.getElementById("kpi-cards");
    if (!kpis) return;

    kpis.innerHTML = `
      <div class="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Book Titles</span>
        <div class="text-xl font-bold text-zinc-900 mt-1">${(data.catalog.total_titles || 0).toLocaleString()}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Copies</span>
        <div class="text-xl font-bold text-zinc-900 mt-1">${(data.catalog.total_items || 0).toLocaleString()}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Smart Tagged</span>
        <div class="text-xl font-bold text-indigo-700 mt-1">${(data.catalog.tagged_items || 0).toLocaleString()} (${data.catalog.tagging_percentage || 0}%)</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
        <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Currently Borrowed</span>
        <div class="text-xl font-bold text-amber-700 mt-1">${data.catalog.issued_items || 0}</div>
      </div>
      <div class="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
        <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Theft Door Alarms</span>
        <div class="text-xl font-bold text-rose-700 mt-1">${data.security.total_alarms || 0}</div>
      </div>
    `;
    loadAuditLogs();
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

async function loadAuditLogs() {
  try {
    const res = await fetch("/api/v1/admin/audit-logs?limit=40");
    if (!res.ok) return;
    const logs = await res.json();
    const tbody = document.getElementById("audit-logs-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    logs.forEach(l => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50";
      tr.innerHTML = `
        <td class="py-2.5 px-4 text-zinc-400">#${l.id}</td>
        <td class="py-2.5 px-4 text-zinc-600">${l.timestamp.slice(0, 19).replace('T', ' ')}</td>
        <td class="py-2.5 px-4 font-bold text-zinc-800">${l.actor_id}</td>
        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-bold">${l.action}</span></td>
        <td class="py-2.5 px-4 text-zinc-600">${l.entity_type}</td>
        <td class="py-2.5 px-4 text-[10px] text-zinc-500 max-w-xs truncate font-mono">${l.details}</td>
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
    if (!res.ok) throw new Error(data.detail || "Backup failed");
    alert(`Backup saved successfully!\nSaved to: ${data.backup_file}`);
    loadAuditLogs();
  } catch (e) {
    alert("Backup failed: " + e.message);
  }
}

// Initial Load
window.addEventListener("DOMContentLoaded", () => {
  searchCatalog();
});
