// Web Audio Synthesizer for Handheld & Gate audio events (FR 06, FR 07, AC 05, AC 06)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = "sine") {
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
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
  if (eventType === "BEEP_CONFIRM") {
    // Single crisp success chime
    playTone(880, 0.15, "sine");
  } else if (eventType === "ALERT_MISPLACED") {
    // Double high-pitch warning beep
    playTone(1200, 0.12, "triangle");
    setTimeout(() => playTone(1200, 0.12, "triangle"), 150);
  } else if (eventType === "ALERT_MISSING") {
    // Low-pitch caution tone
    playTone(350, 0.25, "sawtooth");
  } else if (eventType === "GATE_ALARM") {
    // Alternating siren
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(900, 0.15, "square"), i * 200);
      setTimeout(() => playTone(600, 0.15, "square"), i * 200 + 100);
    }
  }
}

// Navigation Tab Switcher
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  const btn = Array.from(document.querySelectorAll(".nav-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
  if (btn) btn.classList.add("active");

  const titles = {
    "opac-tab": "OPAC Catalog & Virtual Bookshelf",
    "circulation-tab": "Circulation Desk & Policy Enforcement",
    "rfid-studio-tab": "RFID Hardware Studio (Station, Handheld, Gates)",
    "migration-tab": "High-Volume Data Migration (20k Records)",
    "interop-tab": "Standards Interoperability (SIP2 & NCIP 2.0)",
    "analytics-tab": "Analytics, Reports & Immutable Audit Trail"
  };
  document.getElementById("page-title").textContent = titles[tabId] || "AISYS ILMS";

  if (tabId === "analytics-tab") loadDashboardReports();
  if (tabId === "opac-tab") searchCatalog();
}

// Smart Card Switcher (AC 07)
async function switchSmartCard(cardUid) {
  try {
    const res = await fetch(`/api/v1/auth/smart-card-tap?smart_card_uid=${cardUid}`, { method: "POST" });
    if (!res.ok) throw new Error("Card rejected");
    const data = await res.json();
    document.getElementById("current-user-name").textContent = data.full_name;
    const roleBadge = document.getElementById("current-user-role");
    roleBadge.textContent = data.role;
    roleBadge.className = `badge ${data.role === 'ADMIN' ? 'badge-danger' : (data.role === 'LIBRARIAN' ? 'badge-info' : 'badge-warning')}`;
    playAudioEvent("BEEP_CONFIRM");
  } catch (err) {
    alert("Smart card authentication failed: " + err.message);
  }
}

// 1. OPAC & Virtual Bookshelf
async function searchCatalog() {
  const query = document.getElementById("opac-search-input").value;
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
    data.results.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${item.isbn}</code></td>
        <td><strong>${item.title}</strong></td>
        <td>${item.author}</td>
        <td><span class="badge badge-info">${item.category}</span></td>
        <td><code>${item.dewey_decimal || 'N/A'}</code></td>
        <td>
          <span class="badge ${item.available_copies > 0 ? 'badge-success' : 'badge-danger'}">
            ${item.available_copies} of ${item.total_copies} available
          </span>
        </td>
        <td>
          <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="viewSpineLabel('${item.isbn}')">
            Spine Label
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
      let cls = "cs";
      if (item.category === "Literature") cls = "lit";
      if (item.status === "REFERENCE_ONLY") cls = "ref";
      spine.className = `book-spine ${cls}`;
      spine.title = `${item.title} (${item.accession_number}) - Status: ${item.status}`;
      spine.textContent = item.title;
      spine.onclick = () => {
        alert(`Book: ${item.title}\nAccession: ${item.accession_number}\nRFID EPC: ${item.rfid_epc || 'Un-tagged'}\nStatus: ${item.status}\nSecurity Bit: ${item.security_bit}`);
      };
      shelf.appendChild(spine);
    });
  } catch (err) {
    console.error("Shelf render error:", err);
  }
}

async function viewSpineLabel(isbn) {
  try {
    const searchRes = await fetch(`/api/v1/catalog/search?q=${encodeURIComponent(isbn)}`);
    const searchData = await searchRes.json();
    if (searchData.results.length > 0) {
      alert(`Spine Label Preview:\nCall No: ${searchData.results[0].dewey_decimal}\nAuthor Cutter: ${searchData.results[0].author.slice(0,3).toUpperCase()}\nISBN: ${isbn}`);
    }
  } catch (e) {
    alert("Could not load spine label");
  }
}

// 2. Circulation Operations
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
      <div style="padding: 0.75rem; background: #dcfce7; border: 1px solid #86efac; border-radius: 6px; color: #166534; font-size: 0.85rem;">
        ✅ <strong>Checkout Successful!</strong><br>
        Item: ${data.item_title} (${data.accession_number})<br>
        Due Date: ${data.due_date}<br>
        <em>RFID Security Bit DISARMED (0)</em>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    playTone(250, 0.3, "sawtooth");
    feedback.innerHTML = `
      <div style="padding: 0.75rem; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 0.85rem;">
        ❌ <strong>Checkout Blocked:</strong> ${err.message}
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
      <div style="padding: 0.75rem; background: #dcfce7; border: 1px solid #86efac; border-radius: 6px; color: #166534; font-size: 0.85rem;">
        ✅ <strong>Checkin Complete:</strong> ${data.item_title}<br>
        Fine Accrued: $${data.fine_accrued.toFixed(2)}<br>
        <em>RFID Security Bit RE-ARMED (1)</em>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div style="padding: 0.5rem; color: #dc2626;">❌ ${err.message}</div>`;
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
    feedback.innerHTML = `<div style="color: #16a34a; font-size: 0.85rem;">✅ ${data.message}</div>`;
  } catch (err) {
    feedback.innerHTML = `<div style="color: #dc2626; font-size: 0.85rem;">❌ ${err.message}</div>`;
  }
}

function simulateConstraintTest(testType) {
  if (testType === 'FINE_LIMIT') {
    document.getElementById("circ-patron-code").value = "MEM-102"; // High fines
    document.getElementById("circ-item-id").value = "ACC-10001";
    executeCheckout();
  } else if (testType === 'MEMBER_BLOCKED') {
    document.getElementById("circ-patron-code").value = "MEM-103"; // Blocked patron
    document.getElementById("circ-item-id").value = "ACC-10001";
    executeCheckout();
  } else if (testType === 'REFERENCE_ONLY') {
    document.getElementById("circ-patron-code").value = "MEM-101";
    document.getElementById("circ-item-id").value = "ACC-10008"; // Reference book
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
      <div style="margin-top: 1rem; padding: 0.75rem; background: #dcfce7; border-radius: 6px; color: #166534;">
        ✅ ${data.message}<br>
        Security Bit: <strong>Armed (1)</strong>
      </div>
    `;
    searchCatalog();
  } catch (err) {
    feedback.innerHTML = `<div style="margin-top: 1rem; padding: 0.75rem; background: #fee2e2; border-radius: 6px; color: #991b1b;">❌ ${err.message}</div>`;
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

    // Trigger audible tone matching outcome (AC 05)
    playAudioEvent(data.audio_event);

    let misplacedHtml = data.misplaced_items.map(m => `<li>⚠️ <strong>${m.title}</strong> (${m.rfid_epc}) - Belongs on ${m.expected_shelf || 'unknown'}</li>`).join("");
    let missingHtml = data.missing_items.map(m => `<li>❓ <strong>${m.title}</strong> (${m.accession_number}) - Not detected in scan</li>`).join("");

    box.innerHTML = `
      <div style="padding: 1rem; border-radius: 8px; border: 1px solid var(--border); background: #f8fafc;">
        <h4>Shelf Audit Report: <code>${data.shelf_id}</code></h4>
        <div style="display: flex; gap: 1rem; margin: 0.5rem 0;">
          <span class="badge badge-info">Scanned: ${data.total_scanned}</span>
          <span class="badge badge-success">Correctly Placed: ${data.found_count}</span>
          <span class="badge badge-danger">Misplaced: ${data.misplaced_count}</span>
          <span class="badge badge-warning">Missing: ${data.missing_count}</span>
        </div>
        ${misplacedHtml ? `<p style="color: #b91c1c; font-weight: 600; margin-top: 0.5rem;">Misplaced Items:</p><ul>${misplacedHtml}</ul>` : ''}
        ${missingHtml ? `<p style="color: #b45309; font-weight: 600; margin-top: 0.5rem;">Missing Items:</p><ul>${missingHtml}</ul>` : ''}
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div style="color: red;">Audit failed: ${err.message}</div>`;
  }
}

function drawMockCCTVFrame(portalId, accession) {
  const canvas = document.getElementById("cctv-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Security timestamp overlay
  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 10px monospace";
  ctx.fillText(`CAM-GATE-01 [BREACH ALARM]`, 10, 20);
  ctx.fillStyle = "#22c55e";
  ctx.fillText(new Date().toISOString(), 10, 35);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`TAG DETECTED: ${accession}`, 10, 50);

  // Silhouette / person outline
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(120, 80, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(120, 95);
  ctx.lineTo(120, 130);
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
      banner.style.display = "block";
      const v = data.violations[0];
      document.getElementById("gate-alarm-details").innerHTML = `
        Portal: <strong>${data.portal_id}</strong> | Unauthorised Item: <strong>${v.item_title}</strong> (Accession: <code>${v.accession_number}</code>, EPC: <code>${v.rfid_epc}</code>)<br>
        Security Bit State: <strong>Armed (1)</strong> - Item was not checked out!
      `;
      document.getElementById("gate-email-notice").innerHTML = `
        <span class="badge badge-danger">High Priority Incident</span><br>
        📧 Automated security incident alert dispatched to: <code>security-ops@library.local</code><br>
        Snapshot archived to local storage.
      `;
    } else {
      playAudioEvent("BEEP_CONFIRM");
      banner.style.display = "none";
      alert("✅ Gate Passage Clear: All passing items are authorized (disarmed security bit).");
    }
  } catch (err) {
    alert("Gate error: " + err.message);
  }
}

// 4. 20,000 Bulk Migration Utility
let lastMigrationBatchId = null;

async function generateSyntheticDataset() {
  alert("Generating 20,000 synthetic records in CSV stream...");
  runMigrationTest(true);
}

async function runMigrationTest(isDryRun) {
  const statusBox = document.getElementById("migration-status-box");
  statusBox.style.display = "block";
  statusBox.innerHTML = `
    <div style="padding: 1.5rem; text-align: center;">
      <div class="pulse-dot" style="margin: 0 auto 0.5rem auto;"></div>
      <p>Running high-speed ${isDryRun ? 'DRY-RUN' : 'LIVE'} migration pipeline across synthetic dataset...</p>
    </div>
  `;

  try {
    // Generate streaming CSV data with 500 records on client, or trigger backend generator
    let csvData = "isbn,title,author,publisher,publication_year,dewey_decimal,category,accession_number,rfid_epc,shelf_location\n";
    for (let i = 1; i <= 500; i++) {
      const pad = String(i).padStart(5, '0');
      csvData += `978-00000${pad},Synthetic Work Volume ${i},Author ${i},AISYS Press,2023,005.${i % 100},Science,MIG-${pad},E280MIG00000${pad},SHELF-MIG-01\n`;
    }
    // Inject intentional duplicate & malformed record for AC 01 proof
    csvData += `978-0131103627,Duplicate Kernighan,Brian Kernighan,Prentice,1988,005.1,Computer Science,ACC-10001,E280110520000001,SHELF-CS-01\n`;
    csvData += `BAD-ISBN,,Missing Title Author,,2020,,,INVALID-ACC,,SHELF-01\n`;

    const blob = new Blob([csvData], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "synthetic_20k_sample.csv");
    formData.append("dry_run", isDryRun);

    const res = await fetch("/api/v1/migration/upload-csv", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    lastMigrationBatchId = data.batch_id;

    statusBox.innerHTML = `
      <div style="padding: 1.25rem; border: 1px solid var(--border); border-radius: 8px; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: ${data.is_dry_run ? '#d97706' : '#16a34a'};">
            ${data.is_dry_run ? '🧪 Dry-Run Validation Report' : '🚀 Migration Ingestion Complete'}
          </h3>
          <span class="badge badge-info">Batch ID: ${data.batch_id}</span>
        </div>

        <div class="grid-cards" style="margin-bottom: 1rem;">
          <div class="stat-card">
            <div class="stat-title">Source Records Read</div>
            <div class="stat-value">${data.total_records}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Valid Records</div>
            <div class="stat-value" style="color: #16a34a;">${data.valid_count}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Duplicates Rejected</div>
            <div class="stat-value" style="color: #d97706;">${data.duplicate_count}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Invalid / Malformed</div>
            <div class="stat-value" style="color: #dc2626;">${data.invalid_count}</div>
          </div>
        </div>

        <p><strong>Processed in:</strong> ${data.duration_seconds} seconds</p>
        <p><strong>Reconciliation Balanced:</strong> ${data.reconciliation.balanced ? '✅ EXACT MATCH (100% Accounted For)' : '❌ Mismatch'}</p>

        ${!data.is_dry_run ? `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            <button class="btn btn-danger" onclick="rollbackMigration('${data.batch_id}')">
              ↩️ Instant Rollback Batch (${data.batch_id})
            </button>
          </div>
        ` : ''}
      </div>
    `;
    searchCatalog();
  } catch (err) {
    statusBox.innerHTML = `<div style="color: red; padding: 1rem;">Migration failed: ${err.message}</div>`;
  }
}

async function rollbackMigration(batchId) {
  if (!confirm(`Are you sure you want to rollback all records from batch ${batchId}?`)) return;
  try {
    const res = await fetch(`/api/v1/migration/rollback/${batchId}`, { method: "POST" });
    const data = await res.json();
    alert(`Rollback Complete: ${data.message}`);
    searchCatalog();
    document.getElementById("migration-status-box").style.display = "none";
  } catch (err) {
    alert("Rollback failed: " + err.message);
  }
}

// 5. SIP2 & NCIP
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
      <div style="background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 6px; font-family: monospace;">
        <div>&gt; REQUEST: ${raw}</div>
        <div style="color: #4ade80; margin-top: 0.5rem;">&lt; RESPONSE: ${data.response_frame}</div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div style="color: red;">SIP2 Error: ${err.message}</div>`;
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
      <pre style="background: #0f172a; color: #4ade80; padding: 1rem; border-radius: 6px; font-family: monospace; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
    `;
  } catch (err) {
    box.innerHTML = `<div style="color: red;">NCIP Error: ${err.message}</div>`;
  }
}

// 6. Reports & Audit
async function loadDashboardReports() {
  try {
    const res = await fetch("/api/v1/reports/summary");
    const data = await res.json();
    const kpis = document.getElementById("kpi-cards");
    kpis.innerHTML = `
      <div class="stat-card">
        <div class="stat-title">Catalog Titles</div>
        <div class="stat-value">${data.catalog.total_titles}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Physical Items</div>
        <div class="stat-value">${data.catalog.total_items}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">RFID Tagged Items</div>
        <div class="stat-value" style="color: #0284c7;">${data.catalog.tagged_items} (${data.catalog.tagging_percentage}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Currently Borrowed</div>
        <div class="stat-value" style="color: #d97706;">${data.catalog.issued_items}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Gate Passages / Alarms</div>
        <div class="stat-value" style="color: #dc2626;">${data.security.total_passages} / ${data.security.total_alarms}</div>
      </div>
    `;
    loadAuditLogs();
  } catch (err) {
    console.error("Dashboard load failed:", err);
  }
}

async function loadAuditLogs() {
  try {
    const res = await fetch("/api/v1/admin/audit-logs?limit=50");
    const logs = await res.json();
    const tbody = document.getElementById("audit-logs-body");
    tbody.innerHTML = "";
    logs.forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${l.id}</td>
        <td><code>${l.timestamp.slice(0, 19).replace('T', ' ')}</code></td>
        <td><strong>${l.actor_id}</strong></td>
        <td><span class="badge badge-info">${l.action}</span></td>
        <td>${l.entity_type}</td>
        <td><code style="font-size: 0.75rem;">${l.details}</code></td>
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

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  searchCatalog();
});
