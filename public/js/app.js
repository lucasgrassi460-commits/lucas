const API_URL = '/api';

if (!localStorage.getItem('token')) {
    window.location.href = '/index.html';
}

// Helper for authenticated requests
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    // Auto-set JSON content type if body is object and not FormData
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    let response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (error) {
        console.error('Network or CORS error fetching data:', error);
        localStorage.removeItem('token');
        window.location.href = '/index.html';
        throw new Error('Network Error - Redirecting to login');
    }
    
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/index.html';
        throw new Error('Unauthorized');
    }

    return response;
}

document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
});

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
        if (nav.dataset.target === 'ai-agents') {
            document.getElementById('ai-agent-edit-view').classList.add('hidden');
            document.getElementById('ai-agents-list-view').classList.remove('hidden');
            loadAiAgents();
        }
        if (nav.dataset.target === 'robots') {
            document.getElementById('robot-edit-view').classList.add('hidden');
            document.getElementById('robots-list-view').classList.remove('hidden');
            loadRobots();
        }
        if (nav.dataset.target === 'conversations') loadConversations();
        if (nav.dataset.target === 'devices') loadSessions();
        if (nav.dataset.target === 'settings') loadSettings();
    });
});

// Initial Load
loadMetrics();
setInterval(loadMetrics, 60000); // Increased interval to 60s to avoid spamming

// --- Conversations ---
async function loadConversations() {
    try {
        const res = await fetchWithAuth(`${API_URL}/conversations`);
        const conversations = await res.json();
        const list = document.getElementById('conversation-list');
        list.innerHTML = conversations.map(c => `
            <div class="convo-item" onclick="loadMessages('${c.phone}')" style="padding:12px; border-bottom:1px solid var(--border-solid); cursor:pointer; hover:bg-white/5">
                <div style="font-weight:bold;">${c.phone}</div>
                <div class="text-muted" style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.last_message || 'No messages'}</div>
                <div class="text-muted" style="font-size:10px;">${new Date(c.last_message_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

window.loadMessages = async (phone) => {
    try {
        const res = await fetchWithAuth(`${API_URL}/conversations/${phone}/messages`);
        const messages = await res.json();
        const container = document.getElementById('chat-messages');
        const headerTitle = document.getElementById('chat-header-title');
        headerTitle.textContent = `Chat with ${phone}`;
        
        const backBtn = document.getElementById('btn-back-conversations');
        backBtn.style.display = 'inline-block';
        backBtn.onclick = () => {
            document.getElementById('chat-sidebar').classList.remove('hidden-mobile');
            document.getElementById('chat-area-wrapper').classList.add('hidden-mobile');
        };

        document.getElementById('chat-sidebar').classList.add('hidden-mobile');
        document.getElementById('chat-area-wrapper').classList.remove('hidden-mobile');
        
        container.innerHTML = messages.map(m => `
            <div style="align-self: ${m.role === 'user' ? 'flex-start' : 'flex-end'}; 
                        background: ${m.role === 'user' ? 'var(--card-bg)' : 'var(--primary)'}; 
                        color: ${m.role === 'user' ? 'var(--text-main)' : 'white'}; 
                        padding: 8px 12px; 
                        border-radius: 8px; 
                        max-width: 70%; 
                        border: ${m.role === 'user' ? '1px solid var(--border-solid)' : 'none'};
                        word-break: break-word; overflow-wrap: break-word;">
                ${m.text}
                <div style="font-size:10px; opacity:0.7; margin-top:4px;">${new Date(m.created_at).toLocaleTimeString()}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
        
        const input = document.querySelector('#conversations input[type="text"]');
        input.disabled = false;
        input.onkeypress = async (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                const text = input.value.trim();
                input.value = '';
                container.innerHTML += `
                    <div style="align-self: flex-end; background: var(--primary); color: white; padding: 8px 12px; border-radius: 8px; max-width: 70%;">
                        ${text}
                        <div style="font-size:10px; opacity:0.7; margin-top:4px;">Sending...</div>
                    </div>`;
                container.scrollTop = container.scrollHeight;
                alert('Manual reply not fully linked to specific device session yet.');
            }
        };
    } catch (e) { console.error(e); }
};

// --- Metrics ---
let conversationsChart = null;

async function loadMetrics() {
    try {
        const res = await fetchWithAuth(`${API_URL}/metrics`);
        const data = await res.json();
        
        document.getElementById('metric-convos').textContent = data.totalConversations || 0;
        document.getElementById('metric-answered').textContent = data.answeredConversations || 0;
        document.getElementById('metric-unanswered').textContent = data.unansweredConversations || 0;

        // Chart
        const ctx = document.getElementById('conversationsChart');
        if (ctx) {
            if (conversationsChart) conversationsChart.destroy();
            
            const activity = data.dailyActivity || [];
            const labels = activity.map(a => a.date);
            const values = activity.map(a => a.count);
            
            conversationsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Conversations',
                        data: values,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            grid: { color: 'rgba(128, 128, 128, 0.1)' },
                            ticks: { color: 'var(--text-muted)' }
                        },
                        x: { 
                            grid: { display: false },
                            ticks: { color: 'var(--text-muted)' }
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// --- Devices ---
let qrPollInterval;
let currentQrSessionId = null;
let translations = {};

async function loadSessions() {
    try {
        const res = await fetchWithAuth(`${API_URL}/device/session/list`);
        const sessions = await res.json();
        const tbody = document.getElementById('devices-table-body');
        tbody.innerHTML = sessions.map(s => `
          <tr>
            <td>
                <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
                    ${s.sessionName || s.sessionId}
                    <button class="btn-icon" onclick="editSessionName('${s.sessionId}', '${s.sessionName || s.sessionId}')" title="Edit Name">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                    </button>
                </div>
                <div class="text-muted" style="font-size:12px;">${s.number || '-'}</div>
            </td>
            <td><span class="status-badge ${s.status === 'CONNECTED' ? 'connected' : (String(s.status).includes('ERROR') ? 'error' : '')}">${s.status}</span></td>
            <td><span class="text-muted">${s.lastActive ? new Date(s.lastActive).toLocaleString() : '-'}</span></td>
            <td>
              <button class="btn btn-secondary" onclick="showQR('${s.sessionId}')">Show QR</button>
              <button class="btn btn-secondary" onclick="disconnectSession('${s.sessionId}')">Disconnect</button>
            </td>
          </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

window.editSessionName = async (sessionId, currentName) => {
    const newName = prompt('Enter new device name:', currentName);
    if (newName && newName !== currentName) {
        try {
            await fetchWithAuth(`${API_URL}/device/session/${sessionId}`, {
                method: 'PUT',
                body: { sessionName: newName }
            });
            loadSessions();
        } catch(e) {
            alert('Failed to update name');
        }
    }
};

function openQrModal() {
    const qrImg = document.getElementById('qr-image');
    const placeholder = document.querySelector('.qr-container .placeholder');
    const statusText = document.getElementById('qr-status');
    const sessionNameEl = document.getElementById('qr-session-name');
    const nameInput = document.getElementById('device-name-input');
    
    nameInput.value = '';
    nameInput.disabled = false;
    
    qrImg.style.display = 'none';
    placeholder.textContent = 'Initializing connection...';
    placeholder.style.display = 'block';
    statusText.textContent = 'Status: Initializing connection...';
    sessionNameEl.textContent = 'Session Name: -';
    document.getElementById('qr-modal').classList.remove('hidden');
}

async function createSession() {
    const nameInput = document.getElementById('device-name-input');
    const customName = nameInput.value.trim();
    nameInput.disabled = true;

    const res = await fetchWithAuth(`${API_URL}/device/session/create`, { 
        method: 'POST',
        body: { sessionName: customName }
    });
    const data = await res.json();
    
    if (!res.ok) {
        alert(data.error || 'Failed to create session');
        nameInput.disabled = false;
        document.getElementById('qr-modal').classList.add('hidden');
        return;
    }

    currentQrSessionId = data.sessionId;
    updateQrUI({ status: 'QR_READY', qr: data.qr, sessionId: currentQrSessionId });
    startQrPolling(currentQrSessionId);
    loadSessions();
}

function updateQrUI(data) {
    const qrImg = document.getElementById('qr-image');
    const placeholder = document.querySelector('.qr-container .placeholder');
    const statusText = document.getElementById('qr-status');
    const sessionNameEl = document.getElementById('qr-session-name');
    if (data.sessionId) sessionNameEl.textContent = 'Session Name: ' + data.sessionId;
    
    if (data.status === 'QR_READY') {
        qrImg.src = data.qr;
        qrImg.style.display = 'block';
        placeholder.style.display = 'none';
        statusText.textContent = 'Scan the QR Code with your phone';
        statusText.style.color = 'var(--text-primary)';
    } else if (data.status === 'CONNECTED' || data.status === 'inChat' || data.status === 'isLogged') {
        qrImg.style.display = 'none';
        placeholder.textContent = 'Connected successfully';
        placeholder.style.display = 'block';
        statusText.textContent = 'Device connected successfully';
        statusText.style.color = 'var(--success)';
        if (currentQrSessionId) {
            setTimeout(() => {
                document.getElementById('qr-modal').classList.add('hidden');
                currentQrSessionId = null;
                if (qrPollInterval) clearInterval(qrPollInterval);
            }, 2000);
        }
    } else if (data.status === 'QR_EXPIRED' || data.status === 'DISCONNECTED') {
        qrImg.style.display = 'none';
        placeholder.textContent = 'Connection failed, generating new QR code...';
        placeholder.style.display = 'block';
        statusText.textContent = 'Connection failed, retrying...';
        statusText.style.color = 'var(--error)';
        // Auto-retry
        if (currentQrSessionId) {
            createSession();
        }
    } else {
        qrImg.style.display = 'none';
        placeholder.textContent = 'Connecting...';
        placeholder.style.display = 'block';
        statusText.textContent = `Status: ${data.status}`;
        statusText.style.color = 'var(--text-muted)';
    }
}

document.getElementById('btn-connect-device').addEventListener('click', async () => {
    openQrModal();
    try { await createSession(); } catch (e) { console.error(e); }
});

function startQrPolling(sessionId) {
    if (qrPollInterval) { clearInterval(qrPollInterval); qrPollInterval = null; }
    qrPollInterval = setInterval(async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/device/session/${sessionId}/status`);
            const data = await res.json();
            updateQrUI(data);
            if (data.status === 'CONNECTED') loadSessions();
        } catch (e) {}
    }, 3000);
}

window.showQR = async (sessionId) => {
    currentQrSessionId = sessionId;
    openQrModal();
    updateQrUI({ status: 'INITIALIZING', sessionId: currentQrSessionId });
    startQrPolling(sessionId);
};

document.getElementById('btn-close-qr').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.add('hidden');
    if (qrPollInterval) { clearInterval(qrPollInterval); qrPollInterval = null; }
});

window.disconnectSession = async (sessionId) => {
    if (!confirm('Disconnect this session?')) return;
    await fetchWithAuth(`${API_URL}/device/session/${sessionId}/disconnect`, { method: 'POST' });
    loadSessions();
};

document.getElementById('btn-refresh-qr').addEventListener('click', async () => {
    try {
        openQrModal();
        await createSession();
    } catch (e) {}
});

// --- Settings ---
function loadSettings() {
    // Populate Email
    const userJson = localStorage.getItem('user');
    if (userJson) {
        try {
            const user = JSON.parse(userJson);
            if (user.email) document.getElementById('settings-email').value = user.email;
        } catch (e) {}
    }

    // Set current theme
    const theme = localStorage.getItem('theme') || 'system';
    document.getElementById('theme-select').value = theme;
    applyTheme(theme);
}

document.getElementById('theme-select').addEventListener('change', (e) => {
    const theme = e.target.value;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.remove('light-mode');
    } else if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        // System default logic
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }
}

// Initial Theme Check
const savedTheme = localStorage.getItem('theme') || 'system';
applyTheme(savedTheme);


// --- Language Switch ---
async function loadTranslations() {
    try {
        const en = await fetch('/translations/en.json').then(r => r.json());
        const pt = await fetch('/translations/pt-br.json').then(r => r.json());
        translations = { en, ptBR: pt };
    } catch (e) {
        translations = {};
    }
}

function applyLanguage() {
    const lang = localStorage.getItem('language') || 'en';
    const t = translations[lang] || {};
    if (!t) return;

    // Set select value
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = lang;

    // Helper to safe set text
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
    };

    setText('nav-dashboard', t['Dashboard']);
    setText('nav-documents', t['Documents']);
    setText('nav-ai-agents', t['AI Agents']);
    setText('nav-devices', t['Devices']);
    setText('nav-settings', t['Settings']);
    setText('nav-robots', t['Robots']);

    setText('dashboard-title', t['Dashboard']);
    setText('dashboard-subtitle', t['DashboardSubtitle']);
    
    setText('docs-title', t['DocumentsTitle']);
    setText('docs-subtitle', t['DocumentsSubtitle']);

    setText('ai-agents-title', t['AiAgentsTitle']);
    setText('ai-agents-subtitle', t['AiAgentsSubtitle']);

    setText('devices-title', t['DevicesTitle']);
    setText('devices-subtitle', t['DevicesSubtitle']);

    setText('metric-title-conversations', t['MetricConversations']);
    setText('metric-title-answered', t['MetricAnswered']);
    setText('metric-title-unanswered', t['MetricUnanswered']);
    
    setText('metric-convos-label', t['MetricTotalConversations']);
    setText('metric-answered-label', t['MetricAnsweredConversations']);
    setText('metric-unanswered-label', t['MetricUnansweredConversations']);

    setText('chart-title', t['ChartTitle']);

    const searchInput = document.getElementById('docs-search-input');
    if (searchInput) searchInput.placeholder = t['SearchDocuments'] || 'Search documents...';

    setText('th-name', t['ThName']);
    setText('th-type', t['ThType']);
    setText('th-size', t['ThSize']);
    setText('th-chars', t['ThChars']);
    setText('th-actions', t['ThActions']);
    
    setText('docs-pagination-info', t['PaginationShowing']);
    setText('btn-prev', t['Previous']);
    setText('btn-next', t['Next']);

    setText('robots-title', t['RobotsTitle']);
    setText('robots-subtitle', t['RobotsSubtitle']);
    setText('btn-new-robot', t['CreateRobot']);

    setText('th-robot-name', t['ThRobotName']);
    setText('th-robot-idname', t['ThRobotIdName']);
    setText('th-robot-device', t['ThRobotDevice']);
    setText('th-robot-active', t['ThRobotActive']);
    setText('th-robot-actions', t['ThRobotActions']);

    setText('th-device-name', t['ThDeviceName']);
    setText('th-device-status', t['ThDeviceStatus']);
    setText('th-device-active', t['ThDeviceActive']);
    setText('th-device-actions', t['ThDeviceActions']);

    setText('conversations-title', t['ConversationsTitle']);
    setText('conversations-subtitle', t['ConversationsSubtitle']);

    setText('settings-title', t['Settings']);
    setText('settings-subtitle', t['DashboardSubtitle']); // Using same subtitle or new one if available

    setText('settings-account-title', t['Account Details']);
    setText('settings-system-title', t['System Preferences']);
    
    setText('label-email', t['Email']);
    setText('label-password', t['Password']);
    setText('label-language', t['Language']);
    setText('label-timezone', t['Timezone']);
    setText('label-theme', t['Theme']);
    
    setText('btn-save-settings', t['Save Changes']);
    setText('btn-connect-device', t['Connect Device']);
}

document.getElementById('language-select').addEventListener('change', (e) => {
    localStorage.setItem('language', e.target.value);
    applyLanguage();
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    if (!translations || Object.keys(translations).length === 0) await loadTranslations();
    applyLanguage();
    alert('Settings saved!');
});

(async () => {
    await loadTranslations();
    applyLanguage();
})();

// --- Documents ---
async function loadDocuments() {
    try {
        const res = await fetchWithAuth(`${API_URL}/documents`);
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
    const res = await fetchWithAuth(`${API_URL}/docs/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to upload document');
        return;
    }
    fileInput.value = '';
    loadDocuments();
});

window.deleteDocument = async (id) => {
    if (!confirm('Delete this document?')) return;
    await fetchWithAuth(`${API_URL}/docs/${id}`, { method: 'DELETE' });
    loadDocuments();
}

// --- AI Agents ---
let currentAiAgentId = null;

async function loadAiAgents() {
    try {
        const res = await fetchWithAuth(`${API_URL}/ai-agents`);
        const agents = await res.json();
        const tbody = document.getElementById('ai-agents-table-body');
        tbody.innerHTML = agents.map(agent => `
        <tr>
          <td>
            <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" class="text-muted"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
              ${agent.name}
            </div>
          </td>
          <td><span class="text-muted">${agent.device_id || 'Not Connected'}</span></td>
          <td><span class="text-muted">${agent.ai_provider || 'gemini'}</span></td>
          <td><span class="text-muted">${(agent.documents || []).length} files</span></td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" onclick="openAiAgent(${agent.id})">Edit Agent</button>
              <button class="btn btn-danger" onclick="deleteAiAgent(${agent.id})">Delete Agent</button>
            </div>
          </td>
        </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

document.getElementById('btn-new-ai-agent').addEventListener('click', async () => {
    currentAiAgentId = null;
    document.getElementById('ai-agent-form-title').textContent = 'Create AI Agent';
    document.getElementById('ai-agent-name').value = '';
    document.getElementById('ai-agent-instructions').value = '';
    document.getElementById('ai-agent-provider').value = 'gemini';
    
    // Load devices
    const devicesRes = await fetchWithAuth(`${API_URL}/device/session/list`);
    const sessions = await devicesRes.json();
    const deviceSelect = document.getElementById('ai-agent-device-select');
    deviceSelect.innerHTML = '<option value="">Select a device...</option>' + 
        sessions.map(s => `<option value="${s.sessionId}">${s.sessionName || s.sessionId}</option>`).join('');

    // Load docs
    const docsRes = await fetchWithAuth(`${API_URL}/documents`);
    const allDocs = await docsRes.json();
    document.getElementById('ai-agent-docs-list').innerHTML = allDocs.map(doc => `
      <div class="form-group toggle-group" style="margin-bottom: 8px;">
        <label>
          <input type="checkbox" class="ai-agent-doc-checkbox" value="${doc.id}">
          <span style="margin-left:8px;">${doc.original_name}</span>
        </label>
      </div>
    `).join('');

    document.getElementById('ai-agents-list-view').classList.add('hidden');
    document.getElementById('ai-agent-edit-view').classList.remove('hidden');
});

window.openAiAgent = async (id) => {
    currentAiAgentId = id;
    document.getElementById('ai-agent-form-title').textContent = 'Edit AI Agent';
    document.getElementById('ai-agents-list-view').classList.add('hidden');
    document.getElementById('ai-agent-edit-view').classList.remove('hidden');

    const res = await fetchWithAuth(`${API_URL}/ai-agents/${id}`);
    const agent = await res.json();

    document.getElementById('ai-agent-name').value = agent.name;
    document.getElementById('ai-agent-instructions').value = agent.instructions;
    document.getElementById('ai-agent-provider').value = agent.ai_provider || 'gemini';

    // Devices
    const devicesRes = await fetchWithAuth(`${API_URL}/device/session/list`);
    const sessions = await devicesRes.json();
    const deviceSelect = document.getElementById('ai-agent-device-select');
    deviceSelect.innerHTML = '<option value="">Select a device...</option>' + 
        sessions.map(s => `<option value="${s.sessionId}" ${agent.device_id === s.sessionId ? 'selected' : ''}>${s.sessionName || s.sessionId}</option>`).join('');

    // Docs
    const docsRes = await fetchWithAuth(`${API_URL}/documents`);
    const allDocs = await docsRes.json();
    const linkedDocIds = (agent.documents || []).map(d => d.id);

    document.getElementById('ai-agent-docs-list').innerHTML = allDocs.map(doc => `
      <div class="form-group toggle-group" style="margin-bottom: 8px;">
        <label>
          <input type="checkbox" class="ai-agent-doc-checkbox" value="${doc.id}" ${linkedDocIds.includes(doc.id) ? 'checked' : ''}>
          <span style="margin-left:8px;">${doc.original_name}</span>
        </label>
      </div>
    `).join('');
};

document.getElementById('btn-save-ai-agent').addEventListener('click', async () => {
    const name = document.getElementById('ai-agent-name').value;
    const instructions = document.getElementById('ai-agent-instructions').value;
    const deviceId = document.getElementById('ai-agent-device-select').value;
    const provider = document.getElementById('ai-agent-provider').value;
    const selectedDocs = Array.from(document.querySelectorAll('.ai-agent-doc-checkbox:checked')).map(cb => parseInt(cb.value));

    if (!name || !deviceId) {
        alert('Name and Device are required');
        return;
    }

    const payload = { name, instructions, device_id: deviceId, ai_provider: provider, document_ids: selectedDocs };

    if (currentAiAgentId) {
        const res = await fetchWithAuth(`${API_URL}/ai-agents/${currentAiAgentId}`, {
            method: 'PUT',
            body: payload
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to update AI Agent');
            return;
        }
        alert('AI Agent updated');
    } else {
        const res = await fetchWithAuth(`${API_URL}/ai-agents`, {
            method: 'POST',
            body: payload
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to create AI Agent');
            return;
        }
        alert('AI Agent created');
    }
    document.getElementById('ai-agent-edit-view').classList.add('hidden');
    document.getElementById('ai-agents-list-view').classList.remove('hidden');
    loadAiAgents();
});

document.getElementById('btn-back-ai-agents').addEventListener('click', () => {
    document.getElementById('ai-agent-edit-view').classList.add('hidden');
    document.getElementById('ai-agents-list-view').classList.remove('hidden');
    loadAiAgents();
});

window.deleteAiAgent = async (id) => {
    if (!confirm('Delete this AI Agent?')) return;
    await fetchWithAuth(`${API_URL}/ai-agents/${id}`, { method: 'DELETE' });
    loadAiAgents();
};

// Tabs in AI Agent Edit
const aiAgentTabs = document.querySelectorAll('#ai-agent-tabs .bot-tab');
if (aiAgentTabs.length > 0) {
    aiAgentTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#ai-agent-tabs .bot-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#ai-agent-edit-view .bot-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });
}

// --- Robots ---
let currentRobotId = null;
let currentRobotQA = [];

async function loadRobots() {
    try {
        const res = await fetchWithAuth(`${API_URL}/bots`);
        const robots = await res.json();
        const tbody = document.getElementById('robots-table-body');
        tbody.innerHTML = robots.map(robot => `
        <tr>
          <td>
            <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" class="text-muted"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
              ${robot.name}
            </div>
          </td>
          <td><span class="text-muted">${robot.id_name || '-'}</span></td>
          <td><span class="text-muted">${robot.device_id || 'Not Connected'}</span></td>
          <td><span class="status-badge ${robot.active ? 'connected' : ''}">${robot.active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" onclick="openRobot(${robot.id})">Edit</button>
              <button class="btn btn-danger" onclick="deleteRobot(${robot.id})">Delete</button>
            </div>
          </td>
        </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

const btnNewRobot = document.getElementById('btn-new-robot');
if (btnNewRobot) {
    btnNewRobot.addEventListener('click', async () => {
        try {
            currentRobotId = null;
            currentRobotQA = [];
            const titleEl = document.getElementById('robot-form-title');
            if (titleEl) titleEl.textContent = 'Create Robot';
            
            // Reset fields
            const fields = ['robot-name', 'robot-idname', 'robot-handoff', 'robot-split-messages', 'robot-save-payments', 'robot-active'];
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox') el.checked = (id === 'robot-active');
                    else el.value = '';
                }
            });
            
            // Load devices
            const devicesRes = await fetchWithAuth(`${API_URL}/device/session/list`);
            const sessions = await devicesRes.json();
            const deviceSelect = document.getElementById('robot-device-select');
            if (deviceSelect) {
                deviceSelect.innerHTML = '<option value="">Select a device...</option>' + 
                    sessions.map(s => `<option value="${s.sessionId}">${s.sessionName || s.sessionId}</option>`).join('');
            }

            renderRobotQA();

            document.getElementById('robots-list-view').classList.add('hidden');
            document.getElementById('robot-edit-view').classList.remove('hidden');
            
            // Reset tabs
            document.querySelectorAll('#robot-tabs .bot-tab').forEach(t => t.classList.remove('active'));
            const detailTab = document.querySelector('#robot-tabs .bot-tab[data-target="robot-details"]');
            if (detailTab) detailTab.classList.add('active');
            
            document.querySelectorAll('#robot-edit-view .bot-section').forEach(s => s.classList.remove('active'));
            document.getElementById('robot-details').classList.add('active');
        } catch (e) {
            console.error('Error creating robot:', e);
            alert('An error occurred while preparing the form. Please check console.');
        }
    });
}

window.openRobot = async (id) => {
    currentRobotId = id;
    document.getElementById('robot-form-title').textContent = 'Edit Robot';
    document.getElementById('robots-list-view').classList.add('hidden');
    document.getElementById('robot-edit-view').classList.remove('hidden');

    const res = await fetchWithAuth(`${API_URL}/bots/${id}`);
    const robot = await res.json();
    currentRobotQA = robot.qas || [];

    document.getElementById('robot-name').value = robot.name;
    document.getElementById('robot-idname').value = robot.id_name;
    document.getElementById('robot-handoff').checked = robot.human_takeover;
    document.getElementById('robot-split-messages').checked = robot.split_messages;
    document.getElementById('robot-save-payments').checked = robot.save_payments;
    document.getElementById('robot-active').checked = robot.active;

    // Load devices
    const devicesRes = await fetchWithAuth(`${API_URL}/device/session/list`);
    const sessions = await devicesRes.json();
    const deviceSelect = document.getElementById('robot-device-select');
    deviceSelect.innerHTML = '<option value="">Select a device...</option>' + 
        sessions.map(s => `<option value="${s.sessionId}" ${robot.device_id === s.sessionId ? 'selected' : ''}>${s.sessionName || s.sessionId}</option>`).join('');

    renderRobotQA();
};

document.getElementById('btn-save-robot').addEventListener('click', async () => {
    const name = document.getElementById('robot-name').value;
    const idName = document.getElementById('robot-idname').value;
    const deviceId = document.getElementById('robot-device-select').value;
    const handoff = document.getElementById('robot-handoff').checked;
    const split = document.getElementById('robot-split-messages').checked;
    const savePayments = document.getElementById('robot-save-payments').checked;
    const active = document.getElementById('robot-active').checked;

    if (!name || !deviceId) {
        alert('Name and Device are required');
        return;
    }

    const payload = {
        name,
        id_name: idName,
        device_id: deviceId,
        human_takeover: handoff,
        split_messages: split,
        save_payments: savePayments,
        active
    };

    let savedRobotId = currentRobotId;

    if (currentRobotId) {
        const res = await fetchWithAuth(`${API_URL}/bots/${currentRobotId}`, {
            method: 'PUT',
            body: payload
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to update Robot');
            return;
        }
    } else {
        const res = await fetchWithAuth(`${API_URL}/bots`, {
            method: 'POST',
            body: payload
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to create Robot');
            return;
        }
        const created = await res.json();
        savedRobotId = created.id;
    }

    // Save Q&A logic
    if (savedRobotId) {
        const freshRes = await fetchWithAuth(`${API_URL}/bots/${savedRobotId}`);
        const freshBot = await freshRes.json();
        const existingQAs = freshBot.qas || [];
        
        // Delete all existing
        for (const qa of existingQAs) {
            await fetchWithAuth(`${API_URL}/bots/${savedRobotId}/qa/${qa.id}`, { method: 'DELETE' });
        }
        
        // Create all from UI
    let qaError = false;
    for (const qa of currentRobotQA) {
        if (qa.question && qa.answer) {
            const qaRes = await fetchWithAuth(`${API_URL}/bots/${savedRobotId}/qa`, {
                method: 'POST',
                body: { question: qa.question, answer: qa.answer }
            });
            if (!qaRes.ok) {
                const qaData = await qaRes.json();
                alert(qaData.error || 'Failed to save some questions due to plan limits');
                qaError = true;
                break;
            }
        }
    }
    
    if (qaError) {
         document.getElementById('robot-edit-view').classList.add('hidden');
         document.getElementById('robots-list-view').classList.remove('hidden');
         loadRobots();
         return; 
    }
    } // <-- Missing brace added here

    alert('Robot saved successfully');
    document.getElementById('robot-edit-view').classList.add('hidden');
    document.getElementById('robots-list-view').classList.remove('hidden');
    loadRobots();
});

document.getElementById('btn-back-robots').addEventListener('click', () => {
    document.getElementById('robot-edit-view').classList.add('hidden');
    document.getElementById('robots-list-view').classList.remove('hidden');
    loadRobots();
});

window.deleteRobot = async (id) => {
    if (!confirm('Delete this Robot?')) return;
    await fetchWithAuth(`${API_URL}/bots/${id}`, { method: 'DELETE' });
    loadRobots();
};

// Tabs in Robot Edit
document.querySelectorAll('#robot-tabs .bot-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('#robot-tabs .bot-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#robot-edit-view .bot-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
    });
});

// Q&A Management
function renderRobotQA() {
    const container = document.getElementById('qa-list-container');
    container.innerHTML = '';
    
    currentRobotQA.forEach((qa, index) => {
        const div = document.createElement('div');
        div.className = 'qa-item card';
        div.style.marginBottom = '16px';
        div.style.background = 'var(--bg-secondary)';
        div.innerHTML = `
            <div class="flex-between mb-2">
                <span class="text-muted" style="font-size:12px;">Question #${index + 1}</span>
                <button class="btn-icon text-danger" onclick="removeRobotQA(${index})">🗑️</button>
            </div>
            <div class="form-group">
                <input type="text" class="qa-question-input" value="${qa.question}" placeholder="e.g. What is the price?" onchange="updateQA(${index}, 'question', this.value)">
            </div>
            <div class="form-group">
                <textarea class="qa-answer-input" rows="3" placeholder="e.g. The price is $50." onchange="updateQA(${index}, 'answer', this.value)">${qa.answer}</textarea>
            </div>
        `;
        container.appendChild(div);
    });
}

window.addRobotQA = () => {
    // Client-side limit check (optional but good UX)
    // Ideally we should know the user plan here. For now we rely on backend.
    // But we can check if we can add more visually.
    
    currentRobotQA.push({ question: '', answer: '' });
    renderRobotQA();
};

window.removeRobotQA = (index) => {
    currentRobotQA.splice(index, 1);
    renderRobotQA();
};

window.updateQA = (index, field, value) => {
    currentRobotQA[index][field] = value;
};

document.getElementById('btn-add-qa').addEventListener('click', window.addRobotQA);
document.getElementById('btn-clear-qa').addEventListener('click', () => {
    if (confirm('Clear all questions?')) {
        currentRobotQA = [];
        renderRobotQA();
    }
});