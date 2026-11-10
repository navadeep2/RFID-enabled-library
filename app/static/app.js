// ponytail: practical, minimalist frontend logic without toy sound synthesizers or canvas drawings
// =========================================================================
// AISYS Integrated Library Management System
// =========================================================================

// --- Navigation ---
function toggleMobileNav() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (drawer) drawer.classList.toggle("hidden");
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  const desktopBtn = Array.from(document.querySelectorAll(".sidebar-nav-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
  if (desktopBtn) desktopBtn.classList.add("active");

  const titles = {
    "opac-tab": "Catalog & Inventory",
    "circulation-tab": "Circulation Desk",
    "rfid-studio-tab": "RFID Hardware Management",
    "migration-tab": "Data Migration (20k Records)",
    "interop-tab": "Protocols (SIP2 / NCIP 2.0)",
    "analytics-tab": "Audit Trail & Reports"
  };

  document.getElementById("page-title").textContent = titles[tabId] || "AISYS ILMS";

  if (tabId === "analytics-tab") loadDashboardReports();
  if (tabId === "opac-tab") searchCatalog();
  if (tabId === "rfid-studio-tab") loadTaggedItems();
}

// --- Session & RBAC ---
async function switchSmartCard(cardUid) {
  try {
    const res = await fetch(`/api/v1/auth/smart-card-tap?smart_card_uid=${cardUid}`, { method: "POST" });
    if (!res.ok) throw new Error("Card authentication failed");
    const data = await res.json();

    document.getElementById("desktop-user-name").textContent = data.full_name;
    document.getElementById("desktop-user-role").textContent = data.role;
    document.getElementById("mobile-user-name").textContent = `${data.full_name} (${data.role})`;
  } catch (err) {
    alert("Authentication error: " + err.message);
  }
}

// =========================================================================
// 1. Catalog & Inventory
// =========================================================================
let currentCatalogPage = 1;
let catalogPageSize = 30;
let totalCatalogRecords = 0;

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

function fillCirculationFromCatalog(accession) {
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
    if (!res.ok) throw new Error("Failed to load catalog");
    const data = await res.json();

    totalCatalogRecords = data.total || 0;
    document.getElementById("results-count").textContent = totalCatalogRecords.toLocaleString();

    const totalPages = Math.max(1, Math.ceil(totalCatalogRecords / catalogPageSize));
    document.getElementById("current-page-num").textContent = currentCatalogPage;
    document.getElementById("total-pages-num").textContent = totalPages;

    const startIdx = totalCatalogRecords === 0 ? 0 : offset + 1;
    const endIdx = Math.min(offset + catalogPageSize, totalCatalogRecords);
    document.getElementById("pagination-info").textContent = `Showing ${startIdx.toLocaleString()} to ${endIdx.toLocaleString()}`;

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
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-zinc-400">No records found.</td></tr>`;
      return;
    }

    data.results.forEach(item => {
      const isAvailable = (item.available_copies || 0) > 0;
      const sampleAcc = item.sample_accession || 'ACC-10001';
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50";
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-500">${item.isbn}</td>
        <td class="py-2.5 px-3 font-semibold text-zinc-900">${item.title}</td>
        <td class="py-2.5 px-3 text-zinc-600">${item.author}</td>
        <td class="py-2.5 px-3 text-zinc-500">${item.category}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-500">${item.dewey_decimal || '-'}</td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
            isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
          }">
            ${isAvailable ? `Available (${item.available_copies})` : 'Checked Out'}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="fillCirculationFromCatalog('${sampleAcc}')" class="px-2 py-0.5 text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded">
            Desk
          </button>
          <button onclick="openSpineModal('${item.isbn}', '${(item.title || '').replace(/'/g, "\\'")}', '${(item.author || '').replace(/'/g, "\\'")}', '${item.dewey_decimal || ''}')" class="ml-1 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded">
            Label
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Catalog search failed:", err);
  }
}

function openSpineModal(isbn, title, author, dewey) {
  const modal = document.getElementById("spine-modal");
  const content = document.getElementById("spine-modal-content");
  const cutter = author ? author.slice(0, 3).toUpperCase() : "UNK";

  content.innerHTML = `
    <div class="font-bold text-[11px] text-zinc-900 border-b border-zinc-200 pb-1">AISYS ILMS</div>
    <div class="py-1">
      <div class="text-sm font-bold text-zinc-950">${dewey || '005.1'}</div>
      <div class="text-xs text-zinc-600">${cutter}</div>
    </div>
    <div class="text-[10px] text-zinc-400 font-mono border-t border-zinc-200 pt-1">${isbn}</div>
  `;
  modal.classList.remove("hidden");
}

function closeSpineModal() {
  document.getElementById("spine-modal").classList.add("hidden");
}

// =========================================================================
// 2. Circulation Desk
// =========================================================================
function showCirculationFeedback(isError, message) {
  const fb = document.getElementById("circulation-feedback");
  fb.classList.remove("hidden");
  fb.className = `p-3 rounded-lg text-xs font-semibold ${
    isError ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
  }`;
  fb.textContent = message;
}

async function executeCheckout() {
  const patron = document.getElementById("circ-patron-code").value.trim();
  const item = document.getElementById("circ-item-id").value.trim();

  try {
    const res = await fetch("/api/v1/circulation/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_code: patron, item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Checkout rejected");

    showCirculationFeedback(false, `Issued: '${data.item_title}' to ${data.patron_name}. Due: ${data.due_date}. RFID security bit cleared (Disarmed).`);
    searchCatalog();
  } catch (err) {
    showCirculationFeedback(true, `Checkout Blocked: ${err.message}`);
  }
}

async function executeCheckin() {
  const item = document.getElementById("checkin-item-id").value.trim();

  try {
    const res = await fetch("/api/v1/circulation/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Checkin failed");

    const fineNote = data.fine_accrued > 0 ? ` (Overdue fine accrued: $${data.fine_accrued.toFixed(2)})` : '';
    showCirculationFeedback(false, `Checked in: '${data.item_title}'. RFID security bit armed (Protected).${fineNote}`);
    searchCatalog();
  } catch (err) {
    showCirculationFeedback(true, `Checkin Failed: ${err.message}`);
  }
}

async function executeRenewal() {
  const item = document.getElementById("renew-item-id").value.trim();

  try {
    const res = await fetch("/api/v1/circulation/renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_identifier: item })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Renewal failed");

    showCirculationFeedback(false, `Renewed: '${data.item_title}'. New due date: ${data.new_due_date}.`);
  } catch (err) {
    showCirculationFeedback(true, `Renewal Blocked: ${err.message}`);
  }
}

// =========================================================================
// 3. RFID Hardware
// =========================================================================
async function executeTagAssociation() {
  const acc = document.getElementById("tag-accession").value.trim();
  const epc = document.getElementById("tag-epc").value.trim();
  const box = document.getElementById("tag-station-feedback");

  try {
    const res = await fetch("/api/v1/rfid/staff/tag-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accession_number: acc, rfid_epc: epc })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Encoding failed");

    box.innerHTML = `<div class="p-2 bg-emerald-50 text-emerald-800 text-xs rounded mt-2">Tag [${data.rfid_epc}] linked to item '${data.item_title}'.</div>`;
    searchCatalog();
    loadTaggedItems();
  } catch (err) {
    box.innerHTML = `<div class="p-2 bg-rose-50 text-rose-800 text-xs rounded mt-2">${err.message}</div>`;
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
    if (!res.ok) throw new Error(data.detail || "Audit failed");

    const foundCount = data.found_items ? data.found_items.length : 0;
    const misplacedCount = data.misplaced_items ? data.misplaced_items.length : 0;
    const missingCount = data.missing_items ? data.missing_items.length : 0;

    box.innerHTML = `
      <div class="p-2.5 bg-zinc-50 border border-zinc-200 rounded text-xs space-y-1.5 mt-2">
        <div class="font-semibold text-zinc-900">Audit for ${data.shelf_id}: Scanned ${data.total_scanned} | Found ${foundCount} | Misplaced ${misplacedCount} | Missing ${missingCount}</div>
        ${misplacedCount ? `<div class="text-rose-700">Misplaced (${misplacedCount}): ${data.misplaced_items.map(m => `${m.title} [Belongs to: ${m.expected_shelf || 'Other'}]`).join(", ")}</div>` : ''}
        ${missingCount ? `<div class="text-amber-700">Missing from shelf (${missingCount}): ${data.missing_items.map(m => m.title).join(", ")}</div>` : ''}
        ${foundCount ? `<div class="text-emerald-700">Found on shelf (${foundCount}): ${data.found_items.map(m => m.title).join(", ")}</div>` : ''}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="p-2 bg-rose-50 text-rose-800 text-xs rounded mt-2">${err.message}</div>`;
  }
}

async function executeGatePassage() {
  const portal = document.getElementById("gate-portal-id").value;
  const rawEpcs = document.getElementById("gate-passing-epcs").value.split(",").map(s => s.trim()).filter(Boolean);
  const box = document.getElementById("gate-feedback");

  try {
    const res = await fetch("/api/v1/rfid/gate/passage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal_id: portal, detected_epcs: rawEpcs })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Passage check failed");

    if (data.alarm_triggered) {
      const v = (data.violations && data.violations[0]) || {};
      box.innerHTML = `
        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 space-y-1 mt-2">
          <div class="font-bold">🚨 THEFT ALARM TRIGGERED</div>
          <div>Unauthorized item: <strong>${v.item_title || 'Unknown'}</strong> (Barcode: <code>${v.accession_number || rawEpcs[0]}</code>)</div>
          <div class="text-[11px] text-zinc-600">Theft Protection was ARMED. Security incident recorded and alert email dispatched.</div>
        </div>
      `;
    } else {
      box.innerHTML = `
        <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 space-y-1 mt-2">
          <div class="font-bold">✅ Authorized Exit (No Alarm)</div>
          <div>All items passing through were properly checked out and disarmed.</div>
        </div>
      `;
    }
  } catch (err) {
    box.innerHTML = `<div class="p-2 bg-rose-50 text-rose-800 text-xs rounded mt-2">${err.message}</div>`;
  }
}

// --- RFID Tag Registry (Lower Half) ---
let currentTagPage = 1;
let tagPageSize = 25;
let totalTagRecords = 0;

function prevTagPage() {
  if (currentTagPage > 1) {
    currentTagPage--;
    loadTaggedItems();
  }
}

function nextTagPage() {
  const totalPages = Math.max(1, Math.ceil(totalTagRecords / tagPageSize));
  if (currentTagPage < totalPages) {
    currentTagPage++;
    loadTaggedItems();
  }
}

async function loadTaggedItems() {
  const query = (document.getElementById("rfid-tag-search-input")?.value || "").trim();
  const offset = (currentTagPage - 1) * tagPageSize;
  let url = `/api/v1/rfid/tags?limit=${tagPageSize}&offset=${offset}`;
  if (query) url += `&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();

    totalTagRecords = data.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalTagRecords / tagPageSize));
    
    const countEl = document.getElementById("rfid-total-tags-count");
    const currEl = document.getElementById("rfid-current-tag-page");
    const totEl = document.getElementById("rfid-total-tag-pages");
    if (countEl) countEl.textContent = totalTagRecords.toLocaleString();
    if (currEl) currEl.textContent = currentTagPage;
    if (totEl) totEl.textContent = totalPages;

    const prevBtn = document.getElementById("btn-tag-prev");
    const nextBtn = document.getElementById("btn-tag-next");
    if (prevBtn) prevBtn.disabled = (currentTagPage <= 1);
    if (nextBtn) nextBtn.disabled = (currentTagPage >= totalPages);

    const tbody = document.getElementById("rfid-tags-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-zinc-400">No tagged items found.</td></tr>`;
      return;
    }

    data.items.forEach(item => {
      const isArmed = item.security_bit === 1;
      const isAvailable = item.status === "AVAILABLE";
      const tr = document.createElement("tr");
      tr.className = "hover:bg-zinc-50";
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono text-[11px] font-bold text-zinc-900">${item.rfid_epc}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-600">${item.accession_number}</td>
        <td class="py-2.5 px-3 font-semibold text-zinc-900 max-w-xs truncate">${item.title}</td>
        <td class="py-2.5 px-3 text-zinc-500 text-[11px]">${item.author || '-'}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-500">${item.shelf_location || '-'}</td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isArmed ? 'bg-rose-50 text-rose-700' : 'bg-zinc-100 text-zinc-600'
          }">
            ${isArmed ? 'ARMED (1)' : 'DISARMED (0)'}
          </span>
        </td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }">
            ${item.status}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="executeUntag('${item.accession_number}', '${item.rfid_epc}')" class="px-2 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition">
            Untag
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load tagged items:", err);
  }
}

async function executeUntag(accession, epc) {
  if (!confirm(`Are you sure you want to remove RFID tag [${epc}] from book ${accession}?`)) return;
  try {
    const res = await fetch(`/api/v1/rfid/staff/untag-item?identifier=${encodeURIComponent(accession)}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Untag failed");

    alert(`Untagged: ${data.message}`);
    loadTaggedItems();
    searchCatalog();
  } catch (err) {
    alert("Untag error: " + err.message);
  }
}

// =========================================================================
// 4. Data Migration
// =========================================================================
async function runMigrationTest(isDryRun) {
  const box = document.getElementById("migration-status-box");
  box.classList.remove("hidden");
  box.innerHTML = `<div class="p-3 text-xs text-zinc-500 font-mono">Running migration (${isDryRun ? 'dry-run validation' : 'live ingestion'})...</div>`;

  try {
    const res = await fetch(`/api/v1/migration/import-synthetic?dry_run=${isDryRun}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Migration pipeline error");

    box.innerHTML = `
      <div class="p-3 bg-zinc-50 border border-zinc-200 rounded text-xs space-y-2">
        <div class="flex items-center justify-between font-semibold">
          <span class="${data.is_dry_run ? 'text-zinc-800' : 'text-emerald-800'}">
            ${data.is_dry_run ? 'Dry Run Validation Completed' : 'Ingestion Completed'}
          </span>
          <span class="font-mono text-[11px] text-zinc-500">${data.batch_id}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
          <div class="p-1.5 bg-white border border-zinc-200 rounded">Total: <strong>${data.total_records.toLocaleString()}</strong></div>
          <div class="p-1.5 bg-white border border-zinc-200 rounded text-emerald-700">Valid: <strong>${data.valid_count.toLocaleString()}</strong></div>
          <div class="p-1.5 bg-white border border-zinc-200 rounded text-amber-700">Duplicates: <strong>${data.duplicate_count}</strong></div>
          <div class="p-1.5 bg-white border border-zinc-200 rounded text-rose-700">Invalid: <strong>${data.invalid_count}</strong></div>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-zinc-200 text-zinc-500">
          <span>Duration: ${data.duration_seconds}s</span>
          <span>Reconciliation: <strong>${data.reconciliation?.balanced ? 'BALANCED' : 'UNBALANCED'}</strong></span>
        </div>
        ${!data.is_dry_run ? `
          <button onclick="rollbackMigration('${data.batch_id}')" class="px-2 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] rounded font-semibold">
            Rollback Ingestion Batch
          </button>
        ` : ''}
      </div>
    `;

    currentCatalogPage = 1;
    searchCatalog();
  } catch (err) {
    box.innerHTML = `<div class="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">${err.message}</div>`;
  }
}

async function uploadCustomCsv(isDryRun) {
  const fileInput = document.getElementById("custom-csv-file");
  if (!fileInput || !fileInput.files.length) {
    alert("Select a CSV file first.");
    return;
  }
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("dry_run", isDryRun);

  const box = document.getElementById("migration-status-box");
  box.classList.remove("hidden");
  box.innerHTML = `<div class="p-3 text-xs text-zinc-500 font-mono">Uploading ${fileInput.files[0].name}...</div>`;

  try {
    const res = await fetch("/api/v1/migration/upload-csv", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload error");

    box.innerHTML = `
      <div class="p-3 bg-zinc-50 border border-zinc-200 rounded text-xs space-y-1 font-mono">
        <div>Batch: ${data.batch_id}</div>
        <div>Rows: ${data.total_records} | Valid: ${data.valid_count} | Duplicates: ${data.duplicate_count} | Invalid: ${data.invalid_count}</div>
      </div>
    `;
    currentCatalogPage = 1;
    searchCatalog();
  } catch (err) {
    box.innerHTML = `<div class="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">${err.message}</div>`;
  }
}

async function rollbackMigration(batchId) {
  if (!confirm(`Confirm rollback of batch ${batchId}?`)) return;
  try {
    const res = await fetch(`/api/v1/migration/rollback/${batchId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Rollback failed");

    alert(`Rollback complete: removed ${data.deleted_items} items.`);
    currentCatalogPage = 1;
    searchCatalog();
    document.getElementById("migration-status-box").classList.add("hidden");
  } catch (err) {
    alert("Rollback error: " + err.message);
  }
}

// =========================================================================
// 5. Protocols (SIP2 & NCIP)
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
      <div class="p-2.5 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded mt-2 overflow-x-auto">
        &lt; ${data.response_frame}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="p-2 bg-rose-50 text-rose-800 text-xs rounded mt-2">${err.message}</div>`;
  }
}

async function sendNcipRequest() {
  const action = document.getElementById("ncip-action").value;
  let payload;
  try {
    payload = JSON.parse(document.getElementById("ncip-payload").value);
  } catch (e) {
    alert("Invalid JSON payload.");
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
    if (!res.ok) throw new Error(data.detail || "NCIP error");

    box.innerHTML = `
      <pre class="p-2.5 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded mt-2 overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
    `;
  } catch (err) {
    box.innerHTML = `<div class="p-2 bg-rose-50 text-rose-800 text-xs rounded mt-2">${err.message}</div>`;
  }
}

// =========================================================================
// 6. Audit & Reports
// =========================================================================
async function loadDashboardReports() {
  try {
    const res = await fetch("/api/v1/reports/summary");
    if (!res.ok) return;
    const data = await res.json();
    const kpis = document.getElementById("kpi-cards");
    if (!kpis) return;

    kpis.innerHTML = `
      <div class="p-3 bg-white border border-zinc-200 rounded">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 block">Titles</span>
        <div class="text-lg font-bold text-zinc-900 mt-0.5">${(data.catalog.total_titles || 0).toLocaleString()}</div>
      </div>
      <div class="p-3 bg-white border border-zinc-200 rounded">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 block">Total Items</span>
        <div class="text-lg font-bold text-zinc-900 mt-0.5">${(data.catalog.total_items || 0).toLocaleString()}</div>
      </div>
      <div class="p-3 bg-white border border-zinc-200 rounded">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 block">RFID Tagged</span>
        <div class="text-lg font-bold text-zinc-900 mt-0.5">${(data.catalog.tagged_items || 0).toLocaleString()} (${data.catalog.tagging_percentage || 0}%)</div>
      </div>
      <div class="p-3 bg-white border border-zinc-200 rounded">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 block">Borrowed</span>
        <div class="text-lg font-bold text-zinc-900 mt-0.5">${data.catalog.issued_items || 0}</div>
      </div>
      <div class="p-3 bg-white border border-zinc-200 rounded">
        <span class="text-[10px] uppercase font-semibold text-zinc-400 block">Gate Alarms</span>
        <div class="text-lg font-bold text-zinc-900 mt-0.5">${data.security.total_alarms || 0}</div>
      </div>
    `;
    loadAuditLogs();
  } catch (err) {
    console.error("Dashboard metrics failed:", err);
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
        <td class="py-2 px-3 text-zinc-400">#${l.id}</td>
        <td class="py-2 px-3 text-zinc-500">${l.timestamp.slice(0, 19).replace('T', ' ')}</td>
        <td class="py-2 px-3 font-semibold text-zinc-800">${l.actor_id}</td>
        <td class="py-2 px-3"><span class="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-semibold">${l.action}</span></td>
        <td class="py-2 px-3 text-zinc-500">${l.entity_type}</td>
        <td class="py-2 px-3 text-[10px] text-zinc-500 max-w-xs truncate">${l.details}</td>
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
    alert(`Snapshot created: ${data.backup_file}`);
    loadAuditLogs();
  } catch (e) {
    alert("Backup failed: " + e.message);
  }
}

// Initial bootstrap
window.addEventListener("DOMContentLoaded", () => {
  searchCatalog();
});
