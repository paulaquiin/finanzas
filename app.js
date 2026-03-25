const STORAGE_KEY = 'finanzas_txns_v2';
const TEMPLATES_KEY = 'finanzas_templates_v2';

let transactions = [];
let fixedTemplates = [];
let currentMonthId = '';

// DOM Elements: Views
const dashboardView = document.getElementById('dashboardView');
const gastosView = document.getElementById('gastosView');

// DOM Elements: Dashboard
const monthSelector = document.getElementById('monthSelector');
const goToGastosBtn = document.getElementById('goToGastosBtn');
const kpiCardGastos = document.getElementById('kpiCardGastos');
const kpiIngresos = document.getElementById('kpiIngresos');
const kpiGastos = document.getElementById('kpiGastos');
const kpiBeneficio = document.getElementById('kpiBeneficio');
const desgloseTitle = document.getElementById('desgloseTitle');
const donutLegend = document.getElementById('donutLegend');
const historyTableBody = document.querySelector('#historyTable tbody');

// DOM Elements: Gastos View
const backToDashBtn = document.getElementById('backToDashBtn');
const gastosViewTitle = document.getElementById('gastosViewTitle');
const txnTableBody = document.getElementById('txnTableBody');
const addTxnForm = document.getElementById('addTxnForm');
const configFixedBtn = document.getElementById('configFixedBtn');
const loadFixedBtn = document.getElementById('loadFixedBtn');
const clearMonthBtn = document.getElementById('clearMonthBtn');

const txnDate = document.getElementById('txnDate');
const txnDesc = document.getElementById('txnDesc');
const txnCat = document.getElementById('txnCat');
const txnAmount = document.getElementById('txnAmount');

// Global Modal Elements
const globalModal = document.getElementById('globalModal');
const globalModalContent = document.getElementById('globalModalContent');
const globalModalTitle = document.getElementById('globalModalTitle');
const globalModalBody = document.getElementById('globalModalBody');
const globalModalFooter = document.getElementById('globalModalFooter');

// Charts & Colors
let lineChartInst, donutChartInst, barChartInst;
const colors = { blue: '#4A72FF', red: '#FF4A57', green: '#10B981', purple: '#9A55FF', orange: '#FF9F24', gray: '#94A3B8', bgLineBlue: 'rgba(74, 114, 255, 0.1)', bgLineRed: 'rgba(255, 74, 87, 0.1)' };
const categoryLabels = { 'ingresos': 'Ingreso', 'ahorro': 'Ahorro', 'fijos': 'Fijos', 'compras': 'Compras', 'restaurantes': 'Restaurantes', 'extra': 'Extra', 'trabajo': 'Trabajo' };
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];


// --- INITIALIZATION ---
function init() {
    loadData();
    const d = new Date(); currentMonthId = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    
    monthSelector.addEventListener('change', (e) => { currentMonthId = e.target.value; updateDashboardUI(); });
    goToGastosBtn.addEventListener('click', () => toggleView(true));
    kpiCardIngresos.addEventListener('click', () => toggleView(true));
    kpiCardGastos.addEventListener('click', () => toggleView(true));
    backToDashBtn.addEventListener('click', () => toggleView(false));
    
    addTxnForm.addEventListener('submit', handleAddTxn);
    configFixedBtn.addEventListener('click', openTemplates);
    loadFixedBtn.addEventListener('click', loadTemplatesToMonth);
    clearMonthBtn.addEventListener('click', handleClearMonth);
    document.getElementById('bulkAddBtn').addEventListener('click', openBulkAdd);

    renderMonthSelector();
    updateDashboardUI();
}

function loadData() {
    const savedTxns = localStorage.getItem(STORAGE_KEY);
    const savedTpls = localStorage.getItem(TEMPLATES_KEY);
    
    if (savedTxns) transactions = JSON.parse(savedTxns);
    else transactions = [];
    
    if (savedTpls) {
        fixedTemplates = JSON.parse(savedTpls);
    } else {
        fixedTemplates = [];
        saveTemplates();
    }
}

function saveTxns() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function saveTemplates() { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(fixedTemplates)); }

function getMonthsList() {
    const rawSet = new Set(transactions.map(t => t.monthId));
    rawSet.add(currentMonthId);
    return Array.from(rawSet).sort((a,b) => b.localeCompare(a));
}

function getMonthlyAggregates() {
    const months = getMonthsList();
    const agg = [];
    months.forEach(mId => {
        const txns = transactions.filter(t => t.monthId === mId);
        const m = { id: mId, ingresos: 0, ahorro: 0, fijos: 0, compras: 0, restaurantes: 0, extra: 0, trabajo: 0 };
        txns.forEach(t => { if (m[t.category] !== undefined) m[t.category] += parseFloat(t.amount); });
        agg.push(m);
    });
    return agg.sort((a,b) => a.id.localeCompare(b.id)); 
}


// --- UTILS ---
function formatCurrency(num) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num); }
function formatMonth(id) { const [year, month] = id.split('-'); const m = monthNames[parseInt(month) - 1]; return `${m} ${year.substring(2)}`; }
function calcTotalGastos(item) { return item.fijos + item.compras + item.restaurantes + item.extra + item.trabajo; }


// --- GLOBAL MODAL SYSTEM ---
window.closeGlobalModal = function() {
    globalModal.classList.remove('active');
};

function showModal(config) {
    globalModalTitle.textContent = config.title;
    globalModalContent.style.maxWidth = config.maxWidth || '500px';
    globalModalBody.innerHTML = config.body || '';
    globalModalFooter.innerHTML = '';
    
    if (config.footerItems && config.footerItems.length > 0) {
        globalModalFooter.style.display = 'flex';
        globalModalFooter.className = 'form-actions';
        globalModalFooter.style.justifyContent = 'flex-end';
        globalModalFooter.style.gap = '12px';
        
        config.footerItems.forEach(btn => {
            const b = document.createElement('button');
            b.className = `btn ${btn.class || 'btn-primary'}`;
            // Adjust full width if needed
            if (config.footerItems.length === 1 && btn.class !== 'btn-outline') {
                b.style.width = '100%'; 
                b.style.justifyContent = 'center';
            }
            b.textContent = btn.text;
            b.onclick = async (e) => {
                e.preventDefault();
                if (btn.onClick) await btn.onClick();
                if (btn.close !== false) closeGlobalModal();
            };
            globalModalFooter.appendChild(b);
        });
    } else {
        globalModalFooter.style.display = 'none';
    }

    if(config.onRender) config.onRender();
    
    globalModal.classList.add('active');
}

function customAlert(message) {
    return new Promise(resolve => {
        showModal({
            title: 'Aviso',
            body: `<p style="color: var(--text-secondary); font-size: 0.95rem;">${message}</p>`,
            maxWidth: '400px',
            footerItems: [{ text: 'Aceptar', close: true, onClick: resolve }]
        });
    });
}

function customConfirm(message, confirmText = 'Confirmar', isDanger = false) {
    return new Promise(resolve => {
        showModal({
            title: 'Confirmación',
            body: `<p style="color: var(--text-secondary); font-size: 0.95rem;">${message}</p>`,
            maxWidth: '430px',
            footerItems: [
                { text: 'Cancelar', class: 'btn-outline', close: true, onClick: () => resolve(false) },
                { text: confirmText, class: isDanger ? 'btn-danger' : 'btn-primary', close: true, onClick: () => resolve(true) }
            ]
        });
    });
}


// --- VIEWS LOGIC ---
function toggleView(showGastos) {
    if (showGastos) {
        dashboardView.style.display = 'none';
        gastosView.style.display = 'flex';
        updateGastosViewUI();
    } else {
        gastosView.style.display = 'none';
        dashboardView.style.display = 'flex';
        renderMonthSelector();
        updateDashboardUI();
    }
}

function updateGastosViewUI() {
    gastosViewTitle.textContent = `Movimientos: ${formatMonth(currentMonthId)}`;
    const [y, m] = currentMonthId.split('-'); txnDate.value = `${y}-${m}-01`;

    const monthTxns = transactions.filter(t => t.monthId === currentMonthId).sort((a,b) => {
        const d1 = a.date ? new Date(a.date).getTime() : 0;
        const d2 = b.date ? new Date(b.date).getTime() : 0;
        return d2 - d1;
    });

    txnTableBody.innerHTML = '';
    if (monthTxns.length === 0) {
        txnTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-light)">No hay movimientos este mes. Puedes añadir los Fijos usando el botón de arriba.</td></tr>`;
        return;
    }

    monthTxns.forEach(t => {
        const isIngreso = t.category === 'ingresos';
        const isAhorro = t.category === 'ahorro';
        let iconHtml = '<span class="dot dot-red"></span>';
        if (isIngreso || t.category === 'compras') iconHtml = '<span class="dot dot-blue"></span>';
        if (isAhorro || t.category === 'fijos') iconHtml = '<span class="dot dot-purple"></span>';
        if (t.category === 'restaurantes') iconHtml = '<span class="dot dot-green"></span>';
        if (t.category === 'extra') iconHtml = '<span class="dot dot-orange"></span>';
        const sign = isIngreso ? '+' : (isAhorro ? '' : '-');
        const dStr = t.date ? t.date.split('-').reverse().slice(0,2).join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: var(--text-light); font-size: 0.85rem;">${dStr}</td>
            <td style="font-weight: 600;">${t.desc}</td>
            <td><span class="cat-pill">${iconHtml} ${categoryLabels[t.category]}</span></td>
            <td style="text-align: right;" class="${isIngreso?'':'col-roja-val'}">${sign}${formatCurrency(t.amount)}</td>
            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                <button class="btn btn-outline" style="padding: 6px 10px; font-size: 0.8rem;" onclick="openEditTxn('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger-outline" onclick="deleteTxn('${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        txnTableBody.appendChild(tr);
    });
}

function handleAddTxn(e) {
    e.preventDefault();
    const dStr = txnDate.value; 
    const mId = dStr ? dStr.substring(0, 7) : currentMonthId; 
    transactions.push({ id: crypto.randomUUID(), monthId: mId, date: dStr || '', desc: txnDesc.value, category: txnCat.value, amount: parseFloat(txnAmount.value) });
    saveTxns();
    currentMonthId = mId; 
    addTxnForm.reset(); txnDate.value = dStr; 
    updateGastosViewUI();
}

// Transaction Actions using Modals
window.deleteTxn = async function(id) {
    const isYes = await customConfirm("¿Eliminar este movimiento de forma permanente?", "Eliminar", true);
    if(isYes) { transactions = transactions.filter(t => t.id !== id); saveTxns(); updateGastosViewUI(); }
};

async function handleClearMonth() {
    const mt = transactions.filter(t => t.monthId === currentMonthId);
    if(mt.length === 0) {
        await customAlert("No hay movimientos en este mes para vaciar.");
        return;
    }
    const isYes = await customConfirm(`¿Estás SEGURO de que deseas eliminar TODOS los movimientos (${mt.length}) de ${formatMonth(currentMonthId)}? Esta acción no se puede deshacer.`, "Vaciar Mes", true);
    if(isYes) {
        transactions = transactions.filter(t => t.monthId !== currentMonthId);
        saveTxns(); updateGastosViewUI();
    }
}

window.openEditTxn = function(id) {
    const t = transactions.find(x => x.id === id);
    if(!t) return;
    
    showModal({
        title: 'Ajustar Gasto del Mes',
        maxWidth: '430px',
        body: `
            <form id="editTxnFormObj">
                <div style="margin-bottom: 16px;">
                    <label style="display:block; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color:var(--text-secondary);">Concepto</label>
                    <input type="text" id="editTxnDesc" required value="${t.desc}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-family: Inter;">
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="display:block; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color:var(--text-secondary);">Importe Exacto en este mes (€)</label>
                    <input type="number" id="editTxnAmount" step="0.01" min="0" required value="${t.amount}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 1.1rem; font-weight: 700; color: ${t.category === 'ingresos' ? 'var(--text-primary)' : 'var(--brand-red)'}; font-family: Inter;">
                </div>
            </form>
        `,
        footerItems: [
            { text: 'Cancelar', class: 'btn-outline', close: true },
            { 
                text: 'Guardar Cambios', 
                class: 'btn-primary', 
                close: false, 
                onClick: () => {
                    const form = document.getElementById('editTxnFormObj');
                    if(!form.checkValidity()) { form.reportValidity(); return; }
                    
                    t.desc = document.getElementById('editTxnDesc').value;
                    t.amount = parseFloat(document.getElementById('editTxnAmount').value);
                    saveTxns();
                    updateGastosViewUI();
                    closeGlobalModal();
                } 
            }
        ]
    });
};


// Templates Actions using Modals
function openTemplates() {
    showModal({
        title: 'Plantilla de Gastos Fijos',
        maxWidth: '550px',
        body: `
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.9rem;">
                Define aquí los gastos que tienes casi todos los meses (Alquiler, Luz, Internet). Al usar el botón "Cargar", se volcarán al mes actual y <strong>podrás editar el importe exacto para ese mes</strong>.
            </p>
            <form id="tplForm" style="display: flex; gap: 8px; margin-bottom: 24px;">
                <input type="text" id="addTplDesc" placeholder="Concepto (ej. Agua)" required style="flex:2; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-family: Inter;">
                <input type="number" id="addTplAmt" placeholder="Coste base (€)" step="0.01" min="0" required style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-family: Inter;">
                <button type="submit" class="btn btn-primary" style="padding: 10px 16px;"><i class="fa-solid fa-plus"></i></button>
            </form>
            <div class="table-wrapper"><table style="margin-top:0;"><tbody id="tplBody"></tbody></table></div>
        `,
        footerItems: [{ 
            text: 'Guardar y Finalizar', 
            class: 'btn-primary', 
            close: false, 
            onClick: () => {
                const f = document.getElementById('tplForm');
                const desc = document.getElementById('addTplDesc').value;
                const amt = document.getElementById('addTplAmt').value;
                
                // If there's input, try to save it first if valid
                if (desc || amt) {
                    const isDup = fixedTemplates.some(t => t.desc.toLowerCase() === desc.toLowerCase());
                    if (isDup) {
                        alert(`Ya existe un gasto fijo llamado "${desc}". Elige un nombre distinto.`);
                        return;
                    }
                    if (f.reportValidity()) {
                        const d = desc;
                        const a = parseFloat(amt);
                        fixedTemplates.push({ id: crypto.randomUUID(), desc: d, amount: a });
                        saveTemplates();
                    } else {
                        return; // Keep modal open to fix validation errors
                    }
                }
                closeGlobalModal();
            } 
        }],
        onRender: () => {
            const f = document.getElementById('tplForm');
            f.onsubmit = (e) => {
                e.preventDefault();
                const d = document.getElementById('addTplDesc').value;
                const a = parseFloat(document.getElementById('addTplAmt').value);

                const isDup = fixedTemplates.some(t => t.desc.toLowerCase() === d.toLowerCase());
                if (isDup) {
                    alert(`Ya existe un gasto fijo llamado "${d}". Elige un nombre distinto.`);
                    return;
                }

                fixedTemplates.push({ id: crypto.randomUUID(), desc: d, amount: a });
                saveTemplates(); f.reset(); renderTemplatesList();
            };
            renderTemplatesList();
        }
    });
}

function renderTemplatesList() {
    const list = document.getElementById('tplBody');
    if(!list) return;
    list.innerHTML = '';
    if(fixedTemplates.length === 0) { list.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px;">No tienes plantillas configuradas.</td></tr>`; return; }
    fixedTemplates.forEach(tpl => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="font-weight: 600;">${tpl.desc}</td><td style="text-align: right; color: var(--text-secondary); width: 100px;">${formatCurrency(tpl.amount)}</td><td style="text-align: right; width: 60px;"><button class="icon-btn" style="color:var(--brand-red);" onclick="deleteTemplate('${tpl.id}')"><i class="fa-solid fa-trash"></i></button></td>`;
        list.appendChild(tr);
    });
}

window.deleteTemplate = async function(id) {
    // Quick confirm without nested modal to avoid breaking z-indexes or stack
    if(confirm("¿Eliminar plantilla base?")) { 
        fixedTemplates = fixedTemplates.filter(t => t.id !== id); 
        saveTemplates(); 
        renderTemplatesList(); 
    }
};

async function loadTemplatesToMonth() {
    if(fixedTemplates.length === 0) { 
        await customAlert("Primero debes **Configurar Plantilla Fijos**. Actualmente no tienes ninguna guardada."); 
        return; 
    }
    
    let added = 0;
    fixedTemplates.forEach(tpl => {
        const exists = transactions.some(t => t.monthId === currentMonthId && t.desc === tpl.desc);
        if(!exists) {
            transactions.push({ id: crypto.randomUUID(), monthId: currentMonthId, date: `${currentMonthId}-01`, desc: tpl.desc, category: 'fijos', amount: tpl.amount });
            added++;
        }
    });

    if(added > 0) {
        saveTxns(); updateGastosViewUI();
        await customAlert(`Se han añadido ${added} gastos fijos al mes de ${formatMonth(currentMonthId)}.`);
    } else {
        await customAlert("Todos estos gastos fijos ya estaban cargados en este mes.");
    }
}


// --- BULK ADD LOGIC ---
function openBulkAdd() {
    showModal({
        title: 'Añadir en Bloque (Multi-Movimiento)',
        maxWidth: '550px',
        body: `
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.9rem;">
                Pega aquí tu lista de gastos (uno por línea). Puedes usar el formato <strong>"Súper: 25.50"</strong> o simplemente poner <strong>"25.50"</strong> (se usará el concepto por defecto).
            </p>
            <div style="margin-bottom: 16px;">
                <label style="display:block; font-size: 0.8rem; margin-bottom: 6px; font-weight: 600; color:var(--text-secondary);">Destinar todo a la categoría:</label>
                <select id="bulkCat" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-family: Inter;">
                    <option value="compras" selected>Compras</option>
                    <option value="restaurantes">Restaurantes / Comida</option>
                    <option value="extra">Extra / Ocio</option>
                    <option value="fijos">Fijos / Pagos Recurrentes</option>
                    <option value="trabajo">Trabajo / Transporte</option>
                    <option value="ingresos">Ingresos</option>
                </select>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display:block; font-size: 0.8rem; margin-bottom: 6px; font-weight: 600; color:var(--text-secondary);">Lista de movimientos:</label>
                <textarea id="bulkData" rows="8" placeholder="Mercadona: 45.20\nGasolinera: 60\n12.50\n..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); font-family: 'Courier New', monospace; font-size: 0.9rem; resize: vertical;"></textarea>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display:block; font-size: 0.8rem; margin-bottom: 6px; font-weight: 600; color:var(--text-secondary);">Nombre por defecto si no se indica:</label>
                <input type="text" id="bulkDefaultDesc" value="Movimiento en bloque" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-family: Inter;">
            </div>
        `,
        footerItems: [
            { text: 'Cancelar', class: 'btn-outline', close: true },
            { 
                text: 'Importar Movimientos', 
                class: 'btn-primary', 
                close: false, 
                onClick: async () => {
                    const data = document.getElementById('bulkData').value.trim();
                    const cat = document.getElementById('bulkCat').value;
                    const defaultDesc = document.getElementById('bulkDefaultDesc').value || 'Movimiento en bloque';
                    
                    if(!data) { alert("Pega algunos datos primero."); return; }
                    
                    const lines = data.split('\n');
                    let count = 0;
                    
                    lines.forEach(line => {
                        const cleanLine = line.trim();
                        if(!cleanLine) return;
                        
                        let desc = defaultDesc;
                        let valStr = cleanLine;
                        
                        if (cleanLine.includes(':')) {
                            const parts = cleanLine.split(':');
                            desc = parts[0].trim();
                            valStr = parts[parts.length - 1].trim();
                        } else if (cleanLine.includes(' ')) {
                            // Try to see if it's "Concepto 25.50"
                            const parts = cleanLine.split(/\s+/);
                            const lastPart = parts[parts.length - 1].replace(',', '.');
                            if (!isNaN(parseFloat(lastPart))) {
                                valStr = lastPart;
                                desc = parts.slice(0, -1).join(' ').trim();
                            }
                        }
                        
                        const amount = parseFloat(valStr.replace(',', '.'));
                        if (!isNaN(amount)) {
                            transactions.push({
                                id: crypto.randomUUID(),
                                monthId: currentMonthId,
                                date: `${currentMonthId}-01`,
                                desc: desc,
                                category: cat,
                                amount: amount
                            });
                            count++;
                        }
                    });
                    
                    if (count > 0) {
                        saveTxns();
                        updateGastosViewUI();
                        closeGlobalModal();
                        await customAlert(`¡Éxito! Se han importado ${count} movimientos a la categoría "${categoryLabels[cat]}".`);
                    } else {
                        alert("No se ha podido parsear ningún importe válido. Revisa el formato.");
                    }
                } 
            }
        ]
    });
}


// --- DASHBOARD UI CHARTS ---
function renderMonthSelector() {
    monthSelector.innerHTML = ''; const months = getMonthsList();
    months.forEach(mId => { const opt = document.createElement('option'); opt.value = mId; opt.textContent = formatMonth(mId); if(mId === currentMonthId) opt.selected = true; monthSelector.appendChild(opt); });
}

function updateDashboardUI() {
    const aggData = getMonthlyAggregates();
    let currentData = aggData.find(m => m.id === currentMonthId) || { id: currentMonthId, ingresos: 0, ahorro: 0, fijos: 0, compras: 0, restaurantes: 0, extra: 0, trabajo: 0 };

    const totalGastos = calcTotalGastos(currentData); const beneficio = currentData.ingresos - totalGastos;
    kpiIngresos.textContent = formatCurrency(currentData.ingresos); kpiGastos.textContent = formatCurrency(totalGastos); kpiBeneficio.textContent = formatCurrency(beneficio);
    desgloseTitle.textContent = `Desglose ${formatMonth(currentMonthId)}`;

    updateDonutChart(currentData, totalGastos); 
    updateHistoricalCharts(aggData); 
    updateTable(aggData);
}

function updateDonutChart(data, total) {
    let finalLabels = ['Compras', 'Restaurantes', 'Extra', 'Trabajo', 'Fijos'];
    let finalValues = [data.compras, data.restaurantes, data.extra, data.trabajo, data.fijos];
    let finalColors = [colors.blue, colors.green, colors.orange, colors.red, colors.purple];
    
    // Default empty state if no expenses
    if (total === 0) {
        finalValues = [1];
        finalColors = [colors.gray];
        finalLabels = ['Sin gastos'];
    }

    donutLegend.innerHTML = '';
    const legendLabels = ['Compras', 'Restaurantes', 'Extra', 'Trabajo', 'Fijos'];
    const legendValues = [data.compras, data.restaurantes, data.extra, data.trabajo, data.fijos];
    legendLabels.forEach((label, i) => {
        const val = legendValues[i]; const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0; const dotColor = ['dot-blue', 'dot-green', 'dot-orange', 'dot-red', 'dot-purple'][i];
        const row = document.createElement('div'); row.className = 'd-legend-row'; row.innerHTML = `<span class="dot ${dotColor}"></span><span class="d-legend-label">${label}</span><span class="d-legend-amount">${formatCurrency(val)}</span><span class="d-legend-pct">(${pct}%)</span>`; donutLegend.appendChild(row);
    });

    if(donutChartInst) donutChartInst.destroy();
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChartInst = new Chart(ctx, { type: 'doughnut', data: { labels: finalLabels, datasets: [{ data: finalValues, backgroundColor: finalColors, borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: total > 0, callbacks: { label: c => ` ${c.label}: €${c.raw.toFixed(2)}` } } } } });
}

function updateHistoricalCharts(aggData) {
    const labels = aggData.map(m => formatMonth(m.id));
    const ingresosData = aggData.map(m => m.ingresos); const gastosData = aggData.map(m => calcTotalGastos(m));
    if(lineChartInst) lineChartInst.destroy();
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInst = new Chart(ctxLine, { type: 'line', data: { labels: labels, datasets: [ { label: 'Ingresos', data: ingresosData, borderColor: colors.blue, backgroundColor: colors.bgLineBlue, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHitRadius: 10 }, { label: 'Gastos', data: gastosData, borderColor: colors.red, backgroundColor: colors.bgLineRed, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHitRadius: 10 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: {size: 10} } }, y: { grid: { color: '#F1F5F9' }, border: { display: false }, ticks: { callback: v => '€'+v, font: {size: 10} } } } } });

    const dCompras = aggData.map(m => m.compras); const dRestaurantes = aggData.map(m => m.restaurantes); const dExtra = aggData.map(m => m.extra); const dTrabajo = aggData.map(m => m.trabajo);
    if(barChartInst) barChartInst.destroy();
    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChartInst = new Chart(ctxBar, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Compras', data: dCompras, backgroundColor: colors.blue }, { label: 'Comida Fuera', data: dRestaurantes, backgroundColor: colors.green }, { label: 'Extra', data: dExtra, backgroundColor: colors.orange }, { label: 'Trabajo', data: dTrabajo, backgroundColor: colors.red } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 12, font: {size: 10} } }, y: { stacked: true, grid: { color: '#F1F5F9' }, border: { display: false }, ticks: { font: {size: 10} } } } }});
}

function updateTable(aggData) {
    historyTableBody.innerHTML = '';
    const sorted = [...aggData].sort((a,b) => b.id.localeCompare(a.id));
    sorted.forEach(m => {
        const totalGastos = calcTotalGastos(m); const beneficio = m.ingresos - totalGastos;
        let benClass = beneficio >= 0 ? 'pill-green' : 'pill-red'; let benText = formatCurrency(beneficio); if(beneficio < 0) benText = '-' + formatCurrency(Math.abs(beneficio));
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${formatMonth(m.id)}</td><td>${formatCurrency(m.ingresos)}</td><td class="col-roja-val">${formatCurrency(totalGastos)}</td><td>${formatCurrency(m.fijos)}</td><td>${formatCurrency(m.extra)}</td><td><span class="${benClass}">${benText}</span></td>`;
        historyTableBody.appendChild(tr);
    });
}

// Start
init();
