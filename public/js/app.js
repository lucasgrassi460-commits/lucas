const API_URL = 'http://localhost:3000/api';

// Tab Logic
document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));

        nav.classList.add('active');
        document.getElementById(nav.dataset.target).classList.add('active');

        // Trigger tab specific loads
        if (nav.dataset.target === 'metrics') loadMetrics();
        if (nav.dataset.target === 'documents') loadDocuments();
        if (nav.dataset.target === 'bots') {
            document.getElementById('bot-edit-view').classList.add('hidden');
            document.getElementById('bots-list-view').classList.remove('hidden');
            loadBots();
        }
        if (nav.dataset.target === 'devices') loadDeviceStatus();
        // integrations and settings are static views for now
    });
});

// Bots Sub Tabs
document.querySelectorAll('.bot-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.bot-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.bot-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
    });
});

// Initial Load
loadMetrics();
setInterval(loadMetrics, 5000);

// --- Metrics ---
async function loadMetrics() {
    try {
        const res = await fetch(`${API_URL}/metrics`);
        const data = await res.json();
        document.getElementById('metric-convos').textContent = data.conversations || 0;
        // Old elements metric-received and metric-sent were removed.
        // New elements are placeholders for now:
        // metric-revenue, metric-started-sales, metric-completed-sales
    } catch (e) {
        console.error(e);
    }
}

// --- Devices ---
let deviceInterval;
async function loadDeviceStatus() {
    try {
        const res = await fetch(`${API_URL}/device/status`);
        const data = await res.json();

        const badge = document.getElementById('device-status');
        const displayStatus = data.status || 'CONNECTING...';
        badge.textContent = displayStatus;

        badge.className = 'status-badge ' + (displayStatus === 'CONNECTED' ? 'connected' : (displayStatus.includes('ERROR') ? 'error' : ''));

        const qrImg = document.getElementById('qr-image');
        const placeholder = document.querySelector('.qr-container .placeholder');

        if (data.qr && displayStatus !== 'CONNECTED') {
            qrImg.src = data.qr;
            qrImg.style.display = 'block';
            placeholder.style.display = 'none';
            if (!deviceInterval) deviceInterval = setInterval(loadDeviceStatus, 3000);
        } else {
            qrImg.style.display = 'none';
            if (displayStatus === 'CONNECTED') {
                placeholder.textContent = 'WhatsApp is Connected!';
                placeholder.style.display = 'block';
                if (deviceInterval) { clearInterval(deviceInterval); deviceInterval = null; }
                document.getElementById('qr-modal').classList.add('hidden'); // auto-close if open
            } else {
                placeholder.textContent = 'Status: ' + displayStatus + ' ... waiting for QR.';
                placeholder.style.display = 'block';
                if (!deviceInterval) deviceInterval = setInterval(loadDeviceStatus, 3000);
            }
        }
    } catch (e) { console.error(e); }
}

document.getElementById('btn-connect-device').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.remove('hidden');
    loadDeviceStatus();
});

document.getElementById('btn-show-qr').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.remove('hidden');
    loadDeviceStatus();
});

document.getElementById('btn-close-qr').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.add('hidden');
});

document.getElementById('btn-reconnect').addEventListener('click', async () => {
    await fetch(`${API_URL}/device/reconnect`, { method: 'POST' });
    loadDeviceStatus();
});

// --- Documents ---
async function loadDocuments() {
    try {
        const res = await fetch(`${API_URL}/docs`);
        const data = await res.json();
        const tbody = document.getElementById('docs-list');
        tbody.innerHTML = data.map(doc => `
      <tr>
        <td>
          <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" class="text-muted"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            ${doc.original_name}
          </div>
        </td>
        <td><span class="status-badge">${doc.type.includes('pdf') ? 'PDF' : 'TXT'}</span></td>
        <td><span class="text-muted">1.2 MB</span></td>
        <td><span class="text-muted">${doc.content ? doc.content.length : '0'}</span></td>
        <td><button class="btn btn-secondary" style="color:var(--danger); border-color:var(--danger);" onclick="deleteDocument(${doc.id})">Delete</button></td>
      </tr>
    `).join('');
    } catch (e) { }
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('doc-file');
    if (!fileInput.files[0]) return;
    const formData = new FormData();
    formData.append('document', fileInput.files[0]);
    await fetch(`${API_URL}/docs/upload`, { method: 'POST', body: formData });
    fileInput.value = '';
    loadDocuments();
});

window.deleteDocument = async (id) => {
    if (!confirm('Delete this document?')) return;
    await fetch(`${API_URL}/docs/${id}`, { method: 'DELETE' });
    loadDocuments();
}

// --- Bots ---
let currentBotId = null;

async function loadBots() {
    try {
        const res = await fetch(`${API_URL}/bots`);
        const bots = await res.json();
        renderBotsGrid(bots);
    } catch (e) { }
}

function renderBotsGrid(bots) {
    // Note: It's now a List table format, not a Grid, despite the old function name
    const query = (document.getElementById('bot-search') ? document.getElementById('bot-search').value.toLowerCase() : '');
    const filtered = query ? bots.filter(b => b.name.toLowerCase().includes(query) || b.id_name.toLowerCase().includes(query)) : bots;
    const tbody = document.getElementById('bots-table-body');

    tbody.innerHTML = filtered.map(bot => `
    <tr>
      <td>
        <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" class="text-muted"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
          ${bot.name}
        </div>
      </td>
      <td><span class="text-muted">${bot.id_name}</span></td>
      <td><span class="text-muted">${bot.description || 'No description provided'}</span></td>
      <td><span class="status-badge ${bot.active ? 'connected' : ''}">${bot.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-secondary" onclick="openBot(${bot.id})">Edit Robot</button>
      </td>
    </tr>
  `).join('');
}

// document.getElementById('bot-search').addEventListener('input', loadBots); // disable search for now or reimplement it in the filter button


document.getElementById('btn-new-bot').addEventListener('click', async () => {
    currentBotId = null;
    document.getElementById('bot-form-title').textContent = 'Create Bot';
    document.getElementById('bot-form').reset();
    document.getElementById('qa-list').innerHTML = '';

    const docsRes = await fetch(`${API_URL}/docs`);
    const allDocs = await docsRes.json();
    document.getElementById('bot-docs-select-list').innerHTML = allDocs.map(doc => `
      <div class="form-group toggle-group" style="margin-bottom: 8px;">
        <label>
          <input type="checkbox" class="bot-doc-checkbox" value="${doc.id}">
          <span style="margin-left:8px;">${doc.original_name}</span>
        </label>
      </div>
    `).join('');

    document.getElementById('bots-list-view').classList.add('hidden');
    document.getElementById('bot-edit-view').classList.remove('hidden');
});

document.getElementById('btn-back-bots').addEventListener('click', () => {
    document.getElementById('bot-edit-view').classList.add('hidden');
    document.getElementById('bots-list-view').classList.remove('hidden');
    loadBots();
});

window.openBot = async (id) => {
    currentBotId = id;
    document.getElementById('bot-form-title').textContent = 'Edit Bot';
    document.getElementById('bots-list-view').classList.add('hidden');
    document.getElementById('bot-edit-view').classList.remove('hidden');

    const res = await fetch(`${API_URL}/bots/${id}`);
    const bot = await res.json();

    document.getElementById('bot-id').value = bot.id;
    document.getElementById('bot-name').value = bot.name;
    document.getElementById('bot-idname').value = bot.id_name;
    document.getElementById('bot-desc').value = bot.description;
    document.getElementById('bot-human').checked = bot.human_takeover;
    document.getElementById('bot-split').checked = bot.split_messages;
    document.getElementById('bot-active').checked = bot.active;
    document.getElementById('bot-prompt').value = bot.instructions || '';

    const docsRes = await fetch(`${API_URL}/docs`);
    const allDocs = await docsRes.json();
    const linkedDocIds = (bot.documents || []).map(d => d.id);

    document.getElementById('bot-docs-select-list').innerHTML = allDocs.map(doc => `
      <div class="form-group toggle-group" style="margin-bottom: 8px;">
        <label>
          <input type="checkbox" class="bot-doc-checkbox" value="${doc.id}" ${linkedDocIds.includes(doc.id) ? 'checked' : ''}>
          <span style="margin-left:8px;">${doc.original_name}</span>
        </label>
      </div>
    `).join('');

    renderQA(bot.qas);
}

document.getElementById('bot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedDocs = Array.from(document.querySelectorAll('.bot-doc-checkbox:checked')).map(cb => parseInt(cb.value));

    const payload = {
        name: document.getElementById('bot-name').value,
        id_name: document.getElementById('bot-idname').value,
        description: document.getElementById('bot-desc').value,
        human_takeover: document.getElementById('bot-human').checked,
        split_messages: document.getElementById('bot-split').checked,
        active: document.getElementById('bot-active').checked,
        instructions: document.getElementById('bot-prompt').value,
        document_ids: selectedDocs
    };

    if (currentBotId) {
        await fetch(`${API_URL}/bots/${currentBotId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert('Bot updated successfully');
    } else {
        const res = await fetch(`${API_URL}/bots`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const created = await res.json();
        currentBotId = created.id;
        alert('Bot created successfully');
        openBot(currentBotId);
    }
});

// Q&A
function renderQA(qas = []) {
    document.getElementById('qa-list').innerHTML = qas.map(qa => `
    <tr>
      <td>${qa.question}</td>
      <td>${qa.answer}</td>
      <td><button type="button" class="btn btn-danger" onclick="deleteQA(${qa.id})">Delete</button></td>
    </tr>
  `).join('');
}

document.getElementById('btn-add-qa').addEventListener('click', async () => {
    if (!currentBotId) return alert('Please save the bot first before adding Q&A.');

    const q = document.getElementById('qa-question').value;
    const a = document.getElementById('qa-answer').value;
    if (!q || !a) return;

    await fetch(`${API_URL}/bots/${currentBotId}/qa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, answer: a })
    });

    document.getElementById('qa-question').value = '';
    document.getElementById('qa-answer').value = '';
    openBot(currentBotId);
});

window.deleteQA = async (qaId) => {
    if (!confirm('Delete this Q&A?')) return;
    await fetch(`${API_URL}/bots/${currentBotId}/qa/${qaId}`, { method: 'DELETE' });
    openBot(currentBotId);
}
