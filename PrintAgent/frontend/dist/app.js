// ── State ────────────────────────────────────────
let currentConfig = null;
let selectedPaperWidth = 80;
let currentPreviewId = null;
let updateUrl = null;
let pendingSetupKey = '';   // clave validada durante la instalacion inicial
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
        // Con varias marcas hay que decir de cual salio, o el registro no sirve.
        const de = data.account ? ` · ${data.account}` : '';
        addLog('print', `${t} #${data.orderNumber} impreso${de}`);
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

    await refreshStatus();

    // Background checks
    checkPrinterStatus();
    checkForUpdate();
    setInterval(refreshStatus, 5000);       // estado de cada negocio
    setInterval(checkPrinterStatus, 30000); // estado de las impresoras
    setInterval(checkForUpdate, 300000);    // actualizaciones cada 5min
}

/* Con varias marcas en un mismo agente, "conectado / desconectado" a secas ya
   no dice nada: hay que poder ver cuál de los negocios se cayó. */
async function refreshStatus() {
    try {
        const s = await window.go.main.App.GetStatus();
        document.getElementById('print-count').textContent = s.printCount;

        const cuentas = s.accounts || [];
        const conectadas = cuentas.filter(c => c.connected).length;
        const activas = cuentas.filter(c => c.enabled).length;

        if (activas === 0) {
            setDisconnected();
            document.getElementById('status-text').textContent = 'Sin negocios configurados';
        } else if (conectadas === activas) {
            setConnected(activas === 1 ? (cuentas.find(c => c.connected)?.business || '') : `${activas} negocios`);
        } else if (conectadas > 0) {
            setConnected(`${conectadas} de ${activas} negocios`);
        } else {
            setDisconnected();
        }

        const impresoras = [...new Set(cuentas.map(c => c.reciboPrinterName).filter(Boolean))];
        document.getElementById('printer-name').textContent =
            impresoras.length === 0 ? 'Sin impresora'
            : impresoras.length === 1 ? impresoras[0]
            : `${impresoras.length} impresoras`;

        renderAccounts(cuentas);
    } catch (e) { console.error(e); }
}

function renderAccounts(cuentas) {
    const cont = document.getElementById('accounts-list');
    if (!cont) return;

    if (!cuentas.length) {
        cont.innerHTML = '<div class="log-empty">Todavia no hay negocios conectados</div>';
        return;
    }

    cont.innerHTML = cuentas.map(c => {
        const estado = !c.enabled ? 'pausado' : c.connected ? 'conectado' : 'sin conexion';
        const cls = !c.enabled ? 'off' : c.connected ? 'ok' : 'bad';
        const nombre = c.business || c.alias || 'Negocio';
        const modo = c.printMode === 'comanda' ? 'Solo comanda'
                   : c.printMode === 'recibo' ? 'Solo recibo'
                   : c.printMode ? 'Comanda + recibo' : '';
        const qr = c.connected ? (c.showQR ? ' · QR activo' : ' · QR apagado') : '';
        const impresoras = c.comandaPrinterName === c.reciboPrinterName
            ? (c.reciboPrinterName || 'sin impresora')
            : `comanda: ${c.comandaPrinterName || '—'} · recibo: ${c.reciboPrinterName || '—'}`;

        return `
        <div class="acct-card ${cls}">
            <div class="acct-head">
                <span class="acct-dot"></span>
                <span class="acct-name">${esc(nombre)}</span>
                <span class="acct-state">${estado}</span>
            </div>
            <div class="acct-meta">${esc(impresoras)}</div>
            <div class="acct-meta">${esc(modo)}${qr}</div>
            ${c.lastError && !c.connected ? `<div class="acct-err">${esc(c.lastError)}</div>` : ''}
        </div>`;
    }).join('');
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
        pendingSetupKey = key;
        await loadPrinters('select-printer');
    } catch (e) {
        showErr(err, e.message || 'Clave invalida');
    } finally { setBtnLoading(btn, false); }
}

async function saveSetup() {
    const printerName = document.getElementById('select-printer').value;
    try {
        // Primero la impresora: la cuenta necesita apuntar a algo.
        const printerId = await window.go.main.App.SavePrinter('', printerName, selectedPaperWidth, true, 'raster');
        await window.go.main.App.SaveAccount(pendingSetupKey, '', printerId, printerId, true);
        currentConfig = await window.go.main.App.GetConfig();
        showDashboard();
        addLog('info', 'Configuracion guardada');
    } catch (e) {
        addLog('error', `Error: ${e.message || e}`);
    }
}

// ── Dashboard Actions ────────────────────────────
async function testPrint() {
    const impresoras = (currentConfig && currentConfig.printers) || [];
    if (!impresoras.length) { addLog('error', 'No hay ninguna impresora configurada'); return; }

    // Con varias impresoras se pregunta en cual, para no mandar la prueba a la
    // de la cocina cuando lo que se quiere revisar es la de caja.
    let destino = impresoras[0];
    if (impresoras.length > 1) {
        const opciones = impresoras.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
        const elegido = prompt(`En cual impresora imprimo la prueba?\n\n${opciones}`, '1');
        if (elegido === null) return;
        const idx = parseInt(elegido, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= impresoras.length) { addLog('error', 'Opcion invalida'); return; }
        destino = impresoras[idx];
    }

    addLog('info', `Imprimiendo prueba en ${destino.name}...`);
    try {
        await window.go.main.App.TestPrint(destino.id);
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
        const lista = await window.go.main.App.GetPrinterStatusInfo() || [];
        const dot = document.getElementById('printer-dot');
        if (!lista.length) {
            dot.className = 'printer-dot';
            dot.title = 'Sin impresora';
            return;
        }
        // El punto del encabezado resume: si alguna impresora tiene problema,
        // se muestra el problema, no el "todo bien" de las demás.
        const conProblema = lista.find(p => p.online === false);
        const ref = conProblema || lista[0];
        dot.className = 'printer-dot ' + (ref.status || '');
        dot.title = lista.map(p => `${p.name}: ${p.label || ''}`).join('\n');
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
async function openSettings(tab) {
    document.getElementById('settings-modal').classList.remove('hidden');
    await reloadSettings();
    switchSettingsTab(tab || 'cuentas');

    try {
        const auto = await window.go.main.App.IsAutoStartEnabled();
        document.getElementById('toggle-autostart').classList.toggle('on', auto);
    } catch (e) {}

    try {
        const ver = await window.go.main.App.GetVersion();
        document.getElementById('settings-version').textContent = 'v' + ver;
    } catch (e) {}
}

function switchSettingsTab(tab) {
    ['cuentas', 'impresoras', 'general'].forEach(t => {
        document.getElementById('spane-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('stab-' + t).classList.toggle('active', t === tab);
    });
}

async function reloadSettings() {
    currentConfig = await window.go.main.App.GetConfig();
    renderAccountsEditor();
    renderPrintersEditor();
    await loadPrinters('printer-form-name');
}

function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

/* ── Negocios ── */

function renderAccountsEditor() {
    const cont = document.getElementById('accounts-editor');
    const cuentas = (currentConfig && currentConfig.accounts) || [];
    const impresoras = (currentConfig && currentConfig.printers) || [];

    if (!cuentas.length) {
        cont.innerHTML = '<div class="log-empty">Todavia no hay negocios</div>';
        return;
    }

    const opciones = (sel) => impresoras.map(p =>
        `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name || p.id)}</option>`
    ).join('');

    cont.innerHTML = cuentas.map(a => `
        <div class="acct-card">
            <div class="acct-head">
                <span class="acct-name">${esc(a.alias || 'Negocio')}</span>
                <button class="btn-text danger" onclick="removeAccount('${esc(a.printKey)}')">Quitar</button>
            </div>
            <label class="label">Comanda (cocina)</label>
            <select class="input select" data-acct="${esc(a.printKey)}" data-field="comanda">${opciones(a.comandaPrinter)}</select>
            <label class="label mt-10">Recibo (cliente)</label>
            <select class="input select" data-acct="${esc(a.printKey)}" data-field="recibo">${opciones(a.reciboPrinter)}</select>
            <div class="switch-row mt-10">
                <span>Activo</span>
                <button class="switch ${a.enabled ? 'on' : ''}" onclick="toggleAccount('${esc(a.printKey)}')"><div class="switch-thumb"></div></button>
            </div>
        </div>
    `).join('');

    // Guardar en cuanto se cambie una impresora: un "guardar" aparte por cuenta
    // se olvida con facilidad y el pedido se va a la impresora equivocada.
    cont.querySelectorAll('select[data-acct]').forEach(sel => {
        sel.addEventListener('change', () => guardarCuentaDesdeUI(sel.dataset.acct));
    });
}

function cuentaPorLlave(key) {
    return ((currentConfig && currentConfig.accounts) || []).find(a => a.printKey === key);
}

async function guardarCuentaDesdeUI(key) {
    const acc = cuentaPorLlave(key);
    if (!acc) return;
    const cont = document.getElementById('accounts-editor');
    const comanda = cont.querySelector(`select[data-acct="${key}"][data-field="comanda"]`);
    const recibo = cont.querySelector(`select[data-acct="${key}"][data-field="recibo"]`);
    try {
        await window.go.main.App.SaveAccount(
            key, acc.alias || '',
            comanda ? comanda.value : acc.comandaPrinter,
            recibo ? recibo.value : acc.reciboPrinter,
            acc.enabled
        );
        await reloadSettings();
        addLog('info', `Impresoras de ${acc.alias || 'negocio'} actualizadas`);
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function toggleAccount(key) {
    const acc = cuentaPorLlave(key);
    if (!acc) return;
    try {
        await window.go.main.App.SaveAccount(key, acc.alias || '', acc.comandaPrinter, acc.reciboPrinter, !acc.enabled);
        await reloadSettings();
        addLog('info', `${acc.alias || 'Negocio'} ${!acc.enabled ? 'activado' : 'pausado'}`);
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function addAccount() {
    const key = document.getElementById('new-acct-key').value.trim();
    const alias = document.getElementById('new-acct-alias').value.trim();
    const err = document.getElementById('new-acct-error');
    const btn = document.getElementById('btn-add-acct');
    err.classList.add('hidden');

    if (key.length !== 64) { showErr(err, `La clave debe tener 64 caracteres (tienes ${key.length})`); return; }
    if (cuentaPorLlave(key)) { showErr(err, 'Ese negocio ya esta agregado'); return; }

    const impresoras = (currentConfig && currentConfig.printers) || [];
    if (!impresoras.length) { showErr(err, 'Primero agrega una impresora en la pestaña Impresoras'); return; }
    const porDefecto = impresoras[0].id;

    setBtnLoading(btn, true);
    try {
        await window.go.main.App.SaveAccount(key, alias, porDefecto, porDefecto, true);
        document.getElementById('new-acct-key').value = '';
        document.getElementById('new-acct-alias').value = '';
        await reloadSettings();
        addLog('info', 'Negocio agregado');
    } catch (e) {
        showErr(err, e.message || 'No se pudo agregar');
    } finally { setBtnLoading(btn, false); }
}

async function removeAccount(key) {
    const acc = cuentaPorLlave(key);
    if (!confirm(`Quitar ${acc?.alias || 'este negocio'} del agente?`)) return;
    try {
        await window.go.main.App.RemoveAccount(key);
        await reloadSettings();
        addLog('info', 'Negocio quitado');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

/* ── Impresoras ── */

function renderPrintersEditor() {
    const cont = document.getElementById('printers-editor');
    const impresoras = (currentConfig && currentConfig.printers) || [];

    if (!impresoras.length) {
        cont.innerHTML = '<div class="log-empty">Todavia no hay impresoras</div>';
        return;
    }

    const etiquetaQR = { raster: 'QR imagen', native: 'QR nativo', off: 'sin QR' };
    cont.innerHTML = impresoras.map(p => `
        <div class="acct-card">
            <div class="acct-head">
                <span class="acct-name">${esc(p.name || p.id)}</span>
                <span class="acct-state">${p.paperWidth} mm</span>
            </div>
            <div class="acct-meta">${etiquetaQR[p.qrMode] || 'QR imagen'}${p.autoCut ? ' · corte automatico' : ''}</div>
            <div class="btn-row mt-10">
                <button class="btn btn-ghost" onclick="editPrinter('${esc(p.id)}')">Editar</button>
                <button class="btn btn-ghost danger" onclick="removePrinter('${esc(p.id)}')">Quitar</button>
            </div>
        </div>
    `).join('');
}

function editPrinter(id) {
    const p = ((currentConfig && currentConfig.printers) || []).find(x => x.id === id);
    if (!p) return;

    document.getElementById('printer-form-id').value = p.id;
    document.getElementById('printer-form-title').textContent = 'Editar impresora';
    document.getElementById('printer-form-name').value = p.name || '';
    document.getElementById('printer-form-qr').value = p.qrMode || 'raster';
    document.getElementById('toggle-autocut').classList.toggle('on', !!p.autoCut);

    selectedPaperWidth = p.paperWidth || 80;
    document.getElementById('settings-paper').querySelectorAll('.chip').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.width) === selectedPaperWidth);
    });
}

function resetPrinterForm() {
    document.getElementById('printer-form-id').value = '';
    document.getElementById('printer-form-title').textContent = 'Agregar una impresora';
    document.getElementById('printer-form-qr').value = 'raster';
    document.getElementById('toggle-autocut').classList.add('on');
    selectedPaperWidth = 80;
    document.getElementById('settings-paper').querySelectorAll('.chip').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.width) === 80);
    });
}

async function savePrinter() {
    const id = document.getElementById('printer-form-id').value;
    const name = document.getElementById('printer-form-name').value;
    const qrMode = document.getElementById('printer-form-qr').value;
    const autoCut = document.getElementById('toggle-autocut').classList.contains('on');

    try {
        await window.go.main.App.SavePrinter(id, name, selectedPaperWidth, autoCut, qrMode);
        resetPrinterForm();
        await reloadSettings();
        checkPrinterStatus();
        addLog('info', 'Impresora guardada');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
}

async function removePrinter(id) {
    const usada = ((currentConfig && currentConfig.accounts) || [])
        .filter(a => a.comandaPrinter === id || a.reciboPrinter === id);
    const aviso = usada.length
        ? `\n\nLa usan: ${usada.map(a => a.alias || 'un negocio').join(', ')}. Sus tickets pasaran a la primera impresora disponible.`
        : '';
    if (!confirm(`Quitar esta impresora?${aviso}`)) return;

    try {
        await window.go.main.App.RemovePrinter(id);
        await reloadSettings();
        addLog('info', 'Impresora quitada');
    } catch (e) { addLog('error', `Error: ${e.message || e}`); }
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
        if (def) sel.value = def;
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
