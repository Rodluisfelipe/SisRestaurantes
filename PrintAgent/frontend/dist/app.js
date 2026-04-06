// ── State ────────────────────────────────────────
let currentConfig = null;
let selectedPaperWidth = 80;
let currentPreviewId = null;
let updateUrl = null;
const MAX_LOG = 50;

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentConfig = await window.go.main.App.GetConfig();
        const ok = await window.go.main.App.IsConfigured();
        ok ? showDashboard() : showSetup();
    } catch (e) {
        console.error('Init error:', e);
        showSetup();
    }

    // Paper chip clicks
    document.querySelectorAll('.paper-row').forEach(row => {
        row.addEventListener('click', e => {
            const btn = e.target.closest('.chip');
            if (!btn) return;
            row.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPaperWidth = parseInt(btn.dataset.width);
        });
    });

    // Wails events
    window.runtime.EventsOn('connected', name => {
        setConnected(name);
        addLog('info', `Conectado a ${name}`);
    });
    window.runtime.EventsOn('disconnected', () => {
        setDisconnected();
        addLog('error', 'Desconectado del servidor');
    });
    window.runtime.EventsOn('printed', data => {
        document.getElementById('print-count').textContent = data.count;
        const t = data.docType === 'comanda' ? 'Comanda' : 'Recibo';
        addLog('print', `${t} #${data.orderNumber} impreso`);
    });
    window.runtime.EventsOn('printError', msg => {
        addLog('error', `Error: ${msg}`);
    });
});

// ── Screens ──────────────────────────────────────
function showSetup() {
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('step-key').classList.remove('hidden');
    document.getElementById('step-printer').classList.add('hidden');
}

async function showDashboard() {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    try {
        const s = await window.go.main.App.GetStatus();
        document.getElementById('printer-name').textContent = s.printerName || 'Sin impresora';
        document.getElementById('print-count').textContent = s.printCount;
        s.connected ? setConnected(s.businessName) : setDisconnected();
    } catch (e) { console.error(e); }

    // Background checks
    checkPrinterStatus();
    checkForUpdate();
    setInterval(checkPrinterStatus, 30000); // poll every 30s
}

// ── Setup Flow ───────────────────────────────────
async function validateKey() {
    const input = document.getElementById('input-key');
    const key = input.value.trim();
    const err = document.getElementById('key-error');
    const btn = document.getElementById('btn-validate');
    err.classList.add('hidden');

    if (!key) { showErr(err, 'Ingresa tu clave de conexion'); return; }
    if (key.length !== 64) { showErr(err, `La clave debe tener 64 caracteres (tienes ${key.length})`); return; }

    setBtnLoading(btn, true);
    try {
        const biz = await window.go.main.App.ValidateKey(key);
        document.getElementById('step-key').classList.add('hidden');
        document.getElementById('step-printer').classList.remove('hidden');
        document.getElementById('connected-business').textContent = biz;
        currentConfig.printKey = key;
        await loadPrinters('select-printer');
    } catch (e) {
        showErr(err, e.message || 'Clave invalida');
    } finally { setBtnLoading(btn, false); }
}

async function saveSetup() {
    const printer = document.getElementById('select-printer').value;
    try {
        await window.go.main.App.SaveConfig(
            currentConfig.apiUrl || 'https://157-245-125-216.nip.io',
            currentConfig.printKey, printer, selectedPaperWidth, true
        );
        await window.go.main.App.Connect();
        currentConfig = await window.go.main.App.GetConfig();
        showDashboard();
        addLog('info', 'Configuracion guardada');
    } catch (e) { console.error(e); }
}

// ── Dashboard Actions ────────────────────────────
async function testPrint() {
    addLog('info', 'Imprimiendo prueba...');
    try {
        await window.go.main.App.TestPrint();
        addLog('print', 'Prueba impresa correctamente');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function reconnect() {
    addLog('info', 'Reconectando...');
    setDisconnected();
    try { await window.go.main.App.Reconnect(); } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function openTickets() {
    try { await window.go.main.App.OpenTicketsFolder(); }
    catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function openAppFolder() {
    try { await window.go.main.App.OpenAppFolder(); }
    catch (e) { console.error(e); }
}

// ── Reprint ──────────────────────────────────────
async function reprintLast() {
    addLog('info', 'Reimprimiendo ultimo ticket...');
    try {
        await window.go.main.App.ReprintLast();
        addLog('print', 'Reimpresion exitosa');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function reprintJob(id) {
    try {
        await window.go.main.App.ReprintJob(id);
        addLog('print', 'Reimpresion exitosa');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

// ── History ──────────────────────────────────────
async function loadHistory() {
    const list = document.getElementById('history-list');
    try {
        const entries = await window.go.main.App.GetHistory();
        if (!entries || entries.length === 0) {
            list.innerHTML = '<div class="log-empty">Sin impresiones aun...</div>';
            return;
        }
        list.innerHTML = '';
        entries.forEach(e => {
            const ts = new Date(e.timestamp);
            const time = ts.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const date = ts.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
            const typeLabel = e.docType === 'comanda' ? 'Comanda' : 'Recibo';
            const typeClass = e.docType;

            const el = document.createElement('div');
            el.className = 'history-entry';
            el.innerHTML = `
                <div class="history-status ${e.status}"></div>
                <div class="history-info">
                    <div class="history-main">
                        <span class="history-order">#${esc(e.orderNumber)}</span>
                        <span class="history-type ${typeClass}">${typeLabel}</span>
                    </div>
                    <span class="history-time">${date} ${time}</span>
                </div>
                <div class="history-actions">
                    <button class="history-btn" onclick="showPreview('${e.id}', '#${esc(e.orderNumber)} ${typeLabel}')">Ver</button>
                    <button class="history-btn" onclick="reprintJob('${e.id}')">&#8635;</button>
                </div>`;
            list.appendChild(el);
        });
    } catch (e) { console.error(e); }
}

async function clearHistory() {
    try {
        await window.go.main.App.ClearHistory();
        document.getElementById('history-list').innerHTML = '<div class="log-empty">Sin impresiones aun...</div>';
    } catch (e) { console.error(e); }
}

// ── Tabs ─────────────────────────────────────────
function switchTab(tab) {
    document.getElementById('tab-activity').classList.toggle('active', tab === 'activity');
    document.getElementById('tab-history').classList.toggle('active', tab === 'history');
    document.getElementById('section-activity').classList.toggle('hidden', tab !== 'activity');
    document.getElementById('section-history').classList.toggle('hidden', tab !== 'history');
    if (tab === 'history') loadHistory();
}

// ── Preview ──────────────────────────────────────
async function showPreview(id, title) {
    currentPreviewId = id;
    document.getElementById('preview-title').textContent = title;
    document.getElementById('preview-text').textContent = 'Cargando...';
    document.getElementById('preview-modal').classList.remove('hidden');
    try {
        const text = await window.go.main.App.GetTicketPreview(id);
        document.getElementById('preview-text').textContent = text;
    } catch (e) {
        document.getElementById('preview-text').textContent = 'Error cargando vista previa';
    }
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
    currentPreviewId = null;
}

async function reprintFromPreview() {
    if (!currentPreviewId) return;
    try {
        await window.go.main.App.ReprintJob(currentPreviewId);
        addLog('print', 'Reimpresion exitosa');
        closePreview();
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

// ── Printer Status ───────────────────────────────
async function checkPrinterStatus() {
    try {
        const ps = await window.go.main.App.GetPrinterStatusInfo();
        const dot = document.getElementById('printer-dot');
        dot.className = 'printer-dot ' + (ps.status || '');
        dot.title = ps.label || '';
    } catch (e) { /* silent */ }
}

// ── Auto-Update ──────────────────────────────────
async function checkForUpdate() {
    try {
        const u = await window.go.main.App.CheckForUpdate();
        if (u && u.available) {
            document.getElementById('update-version').textContent = 'v' + u.version;
            updateUrl = u.url;
            document.getElementById('update-banner').classList.remove('hidden');
        }
    } catch (e) { /* silent */ }
}

function openUpdateLink() {
    if (updateUrl) window.runtime.BrowserOpenURL(updateUrl);
}

function dismissUpdate() {
    document.getElementById('update-banner').classList.add('hidden');
}

// ── Quit ─────────────────────────────────────────
async function quitApp() {
    if (confirm('Cerrar el agente de impresion?')) {
        try { await window.go.main.App.QuitApp(); } catch (e) {}
    }
}

// ── Settings ─────────────────────────────────────
async function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    currentConfig = await window.go.main.App.GetConfig();

    await loadPrinters('settings-printer');
    const sel = document.getElementById('settings-printer');
    if (currentConfig.printerName) sel.value = currentConfig.printerName;

    const paper = document.getElementById('settings-paper');
    paper.querySelectorAll('.chip').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.width) === currentConfig.paperWidth);
    });
    selectedPaperWidth = currentConfig.paperWidth;

    document.getElementById('toggle-autocut').classList.toggle('on', currentConfig.autoCut);

    try {
        const auto = await window.go.main.App.IsAutoStartEnabled();
        document.getElementById('toggle-autostart').classList.toggle('on', auto);
    } catch (e) {}

    const k = currentConfig.printKey || '';
    document.getElementById('settings-key').value = k.substring(0, 8) + '...' + k.substring(k.length - 8);

    try {
        const ver = await window.go.main.App.GetVersion();
        document.getElementById('settings-version').textContent = 'v' + ver;
    } catch (e) {}
}

function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

async function saveSettings() {
    const printer = document.getElementById('settings-printer').value;
    const autoCut = document.getElementById('toggle-autocut').classList.contains('on');
    try {
        await window.go.main.App.SaveConfig(currentConfig.apiUrl, currentConfig.printKey, printer, selectedPaperWidth, autoCut);
        currentConfig = await window.go.main.App.GetConfig();
        document.getElementById('printer-name').textContent = printer;
        closeSettings();
        addLog('info', 'Configuracion actualizada');
        checkPrinterStatus();
    } catch (e) { console.error(e); }
}

function toggleAutocut() { document.getElementById('toggle-autocut').classList.toggle('on'); }

async function toggleAutostart() {
    const el = document.getElementById('toggle-autostart');
    const next = !el.classList.contains('on');
    try {
        await window.go.main.App.SetAutoStart(next);
        el.classList.toggle('on', next);
        addLog('info', next ? 'Inicio automatico activado' : 'Inicio automatico desactivado');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

function resetConfig() {
    if (confirm('Esto desconectara el agente. Continuar?')) { closeSettings(); showSetup(); }
}

// ── Helpers ──────────────────────────────────────
async function loadPrinters(id) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    try {
        const printers = await window.go.main.App.GetPrinters();
        const def = await window.go.main.App.GetDefaultPrinterName();
        printers.forEach(n => {
            const o = document.createElement('option');
            o.value = n;
            o.textContent = n + (n === def ? ' (predeterminada)' : '');
            sel.appendChild(o);
        });
        if (currentConfig && currentConfig.printerName) sel.value = currentConfig.printerName;
        else if (def) sel.value = def;
    } catch (e) { console.error(e); }
}

function setConnected(name) {
    const c = document.getElementById('status-card');
    c.className = 'card status-card connected';
    document.getElementById('status-text').textContent = 'Conectado';
    document.getElementById('dash-business').textContent = name;
}

function setDisconnected() {
    const c = document.getElementById('status-card');
    c.className = 'card status-card error';
    document.getElementById('status-text').textContent = 'Desconectado';
}

function addLog(type, msg) {
    const list = document.getElementById('log-list');
    const empty = list.querySelector('.log-empty');
    if (empty) empty.remove();

    const el = document.createElement('div');
    el.className = 'log-entry';
    const now = new Date();
    const t = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerHTML = `<div class="log-pip ${type}"></div><span class="log-msg">${esc(msg)}</span><span class="log-time">${t}</span>`;
    list.insertBefore(el, list.firstChild);
    while (list.children.length > MAX_LOG) list.removeChild(list.lastChild);
}

function clearLog() {
    document.getElementById('log-list').innerHTML = '<div class="log-empty">Esperando actividad...</div>';
}

function showErr(el, m) { el.textContent = m; el.classList.remove('hidden'); }

function setBtnLoading(btn, on) {
    const l = btn.querySelector('.btn-label'), s = btn.querySelector('.btn-spinner');
    if (on) { l && l.classList.add('hidden'); s && s.classList.remove('hidden'); btn.disabled = true; }
    else { l && l.classList.remove('hidden'); s && s.classList.add('hidden'); btn.disabled = false; }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
