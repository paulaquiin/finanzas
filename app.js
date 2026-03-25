const STORAGE_KEY = 'finanzas_txns_v1';
let transactions = [];
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
const kpiAhorro = document.getElementById('kpiAhorro');

const desgloseTitle = document.getElementById('desgloseTitle');
const donutLegend = document.getElementById('donutLegend');
const historyTableBody = document.querySelector('#historyTable tbody');

// DOM Elements: Gastos View
const backToDashBtn = document.getElementById('backToDashBtn');
const gastosViewTitle = document.getElementById('gastosViewTitle');
const txnTableBody = document.getElementById('txnTableBody');
const addTxnForm = document.getElementById('addTxnForm');
const copyFixedBtn = document.getElementById('copyFixedBtn');

// Form Inputs
const txnDate = document.getElementById('txnDate');
const txnDesc = document.getElementById('txnDesc');
const txnCat = document.getElementById('txnCat');
const txnAmount = document.getElementById('txnAmount');

// Charts
let lineChartInst, donutChartInst, barChartInst;

// Colors
const colors = {
    blue: '#4A72FF',
    red: '#FF4A57',
    green: '#10B981',
    purple: '#9A55FF',
    orange: '#FF9F24',
    gray: '#94A3B8',
    bgLineBlue: 'rgba(74, 114, 255, 0.1)',
    bgLineRed: 'rgba(255, 74, 87, 0.1)'
};

const categoryLabels = {
    'ingresos': 'Ingreso',
    'ahorro': 'Ahorro',
    'fijos': 'Fijos',
    'compras': 'Compras',
    'restaurantes': 'Restaurantes',
    'extra': 'Extra',
    'trabajo': 'Trabajo'
};

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// --- INITIALIZATION ---
function init() {
    loadData();
    
    // Default to current month
    const d = new Date();
    currentMonthId = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Listeners navigation
    monthSelector.addEventListener('change', (e) => {
        currentMonthId = e.target.value;
        updateDashboardUI();
    });

    goToGastosBtn.addEventListener('click', () => toggleView(true));
    kpiCardGastos.addEventListener('click', () => toggleView(true));
    backToDashBtn.addEventListener('click', () => toggleView(false));
    
    // Listeners Gastos actions
    addTxnForm.addEventListener('submit', handleAddTxn);
    copyFixedBtn.addEventListener('click', handleCopyFixed);

    // Initial render
    renderMonthSelector();
    updateDashboardUI();
}

function generateDummyTransactions() {
    const defaultData = [
        { id: '2024-03', ingresos: 810.91, ahorro: 0, fijos: 1015.82, compras: 300, restaurantes: 200, extra: 68.80, trabajo: 345.92 },
        { id: '2026-02', ingresos: 1896.58, ahorro: 0, fijos: 1061.50, compras: 450, restaurantes: 300, extra: 270.22, trabajo: 186.92 },
        { id: '2026-03', ingresos: 4000.00, ahorro: 500, fijos: 1336.50, compras: 365.35, restaurantes: 217.33, extra: 689.95, trabajo: 78.24 }
    ];

    let txns = [];
    
    // Build dummy monthly data
    const all = [...defaultData];
    let d = new Date('2024-04-01');
    const end = new Date('2026-02-01');
    while(d < end) {
        all.push({
            id: `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`,
            ingresos: 2000 + Math.random() * 1000,
            ahorro: 200,
            fijos: 1100 + Math.random() * 100,
            compras: 200 + Math.random() * 300,
            restaurantes: 100 + Math.random() * 200,
            extra: 50 + Math.random() * 500,
            trabajo: 50 + Math.random() * 100
        });
        d.setMonth(d.getMonth() + 1);
    }

    // Convert into list of transactions
    all.forEach(m => {
        const createTxn = (cat, amount, desc) => {
            if(amount > 0) {
                txns.push({ id: crypto.randomUUID(), monthId: m.id, date: `${m.id}-15`, desc, category: cat, amount });
            }
        };
        createTxn('ingresos', m.ingresos, 'Cobro Mensual');
        createTxn('ahorro', m.ahorro, 'Ahorro Meta');
        createTxn('fijos', m.fijos, 'Alquiler y Suministros');
        createTxn('compras', m.compras, 'Supermercado y Ticket');
        createTxn('restaurantes', m.restaurantes, 'Cenas y Salidas');
        createTxn('extra', m.extra, 'Varios');
        createTxn('trabajo', m.trabajo, 'Transporte y Oficina');
    });

    return txns;
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        transactions = generateDummyTransactions();
        saveData();
    } else {
        transactions = JSON.parse(saved);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// --- DATA AGGREGATION ---
function getMonthsList() {
    const rawSet = new Set(transactions.map(t => t.monthId));
    // Always include current active month even if empty
    rawSet.add(currentMonthId);
    return Array.from(rawSet).sort((a,b) => b.localeCompare(a)); // Newest first
}

function getMonthlyAggregates() {
    const months = getMonthsList();
    const agg = [];
    
    months.forEach(mId => {
        const txns = transactions.filter(t => t.monthId === mId);
        
        const m = {
            id: mId,
            ingresos: 0, ahorro: 0, fijos: 0, compras: 0, restaurantes: 0, extra: 0, trabajo: 0
        };
        
        txns.forEach(t => {
            if (m[t.category] !== undefined) {
                m[t.category] += parseFloat(t.amount);
            }
        });
        
        agg.push(m);
    });
    
    // Return sorted oldest to newest for charts
    return agg.sort((a,b) => a.id.localeCompare(b.id)); 
}


// --- UTILS ---
function formatCurrency(num) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
}

function formatMonth(id) {
    const [year, month] = id.split('-');
    const m = monthNames[parseInt(month) - 1];
    return `${m} ${year.substring(2)}`;
}

function calcTotalGastos(item) {
    return item.fijos + item.compras + item.restaurantes + item.extra + item.trabajo;
}


// --- NAVIGATION & VIEWS ---
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


// --- GASTOS VIEW LOGIC ---
function updateGastosViewUI() {
    gastosViewTitle.textContent = `Movimientos: ${formatMonth(currentMonthId)}`;
    
    // Set default date in form roughly to this month
    const [y, m] = currentMonthId.split('-');
    txnDate.value = `${y}-${m}-01`;

    const monthTxns = transactions.filter(t => t.monthId === currentMonthId)
                        .sort((a, b) => {
                            const d1 = a.date ? new Date(a.date).getTime() : 0;
                            const d2 = b.date ? new Date(b.date).getTime() : 0;
                            return d2 - d1;
                        });

    // Render table
    txnTableBody.innerHTML = '';
    
    if (monthTxns.length === 0) {
        txnTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-light)">No hay movimientos registrados este mes. Añade uno arriba o copia los fijos.</td></tr>`;
        return;
    }

    monthTxns.forEach(t => {
        const isIngreso = t.category === 'ingresos';
        const isAhorro = t.category === 'ahorro';
        
        let iconHtml = '<span class="dot dot-red"></span>';
        if (isIngreso) iconHtml = '<span class="dot dot-blue"></span>';
        if (isAhorro) iconHtml = '<span class="dot dot-purple"></span>';
        if (t.category === 'fijos') iconHtml = '<span class="dot dot-purple"></span>';
        if (t.category === 'compras') iconHtml = '<span class="dot dot-blue"></span>';
        if (t.category === 'restaurantes') iconHtml = '<span class="dot dot-green"></span>';
        if (t.category === 'extra') iconHtml = '<span class="dot dot-orange"></span>';
        
        const amClass = isIngreso ? 'col-roja' : (isAhorro?'':'col-roja-val');
        const sign = isIngreso ? '+' : (isAhorro ? '' : '-');
        
        // Date format DD/MM
        const dStr = t.date ? t.date.split('-').reverse().slice(0,2).join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: var(--text-light); font-size: 0.85rem;">${dStr}</td>
            <td style="font-weight: 600;">${t.desc}</td>
            <td><span class="cat-pill">${iconHtml} ${categoryLabels[t.category]}</span></td>
            <td style="text-align: right;" class="${isIngreso?'':'col-roja-val'}">${sign}${formatCurrency(t.amount)}</td>
            <td style="text-align: right;">
                <button class="btn btn-danger-outline" onclick="deleteTxn('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        txnTableBody.appendChild(tr);
    });
}

function handleAddTxn(e) {
    e.preventDefault();
    
    const dStr = txnDate.value; // YYYY-MM-DD or empty
    const mId = dStr ? dStr.substring(0, 7) : currentMonthId; // Extract YYYY-MM
    
    const t = {
        id: crypto.randomUUID(),
        monthId: mId,
        date: dStr || '',
        desc: txnDesc.value,
        category: txnCat.value,
        amount: parseFloat(txnAmount.value)
    };
    
    transactions.push(t);
    saveData();
    
    // Refresh
    currentMonthId = mId; // Keep focus on the month we just inserted to
    addTxnForm.reset();
    txnDate.value = dStr; // Keep same date roughly
    
    updateGastosViewUI();
}

window.deleteTxn = function(id) {
    if(confirm("¿Seguro que deseas eliminar este movimiento?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        updateGastosViewUI();
    }
};

function handleCopyFixed() {
    // 1. Determine previous month
    let [y, m] = currentMonthId.split('-').map(Number);
    m -= 1;
    if(m === 0) { m = 12; y -= 1; }
    const prevMonthId = `${y}-${m.toString().padStart(2, '0')}`;
    
    // 2. Extract specific fixed transactions from prev month
    const prevFixed = transactions.filter(t => t.monthId === prevMonthId && t.category === 'fijos');
    
    if(prevFixed.length === 0) {
        alert("No se encontraron Gastos Fijos en el mes anterior (" + formatMonth(prevMonthId) + ") para copiar.");
        return;
    }
    
    // 3. Clone them
    let added = 0;
    prevFixed.forEach(pt => {
        // Adjust date to this month but roughly same day if exists
        const day = pt.date ? pt.date.split('-')[2] : '01';
        const newDate = pt.date ? `${currentMonthId}-${day}` : '';
        
        // Prevent exact duplicates
        const exists = transactions.some(t => t.monthId === currentMonthId && t.desc === pt.desc && t.amount === pt.amount);
        if(!exists) {
            transactions.push({
                id: crypto.randomUUID(),
                monthId: currentMonthId,
                date: newDate,
                desc: pt.desc,
                category: pt.category,
                amount: pt.amount
            });
            added++;
        }
    });
    
    if(added > 0) {
        saveData();
        updateGastosViewUI();
    } else {
        alert("Los gastos fijos de " + formatMonth(prevMonthId) + " ya estaban copiados en este mes.");
    }
}


// --- DASHBOARD UI AGGREGATION ---
function renderMonthSelector() {
    monthSelector.innerHTML = '';
    const months = getMonthsList();
    
    months.forEach(mId => {
        const opt = document.createElement('option');
        opt.value = mId;
        opt.textContent = formatMonth(mId);
        if(mId === currentMonthId) opt.selected = true;
        monthSelector.appendChild(opt);
    });
}

function updateDashboardUI() {
    const aggData = getMonthlyAggregates();
    if(aggData.length === 0) return;
    
    let currentData = aggData.find(m => m.id === currentMonthId);
    if(!currentData) {
        currentData = { id: currentMonthId, ingresos: 0, ahorro: 0, fijos: 0, compras: 0, restaurantes: 0, extra: 0, trabajo: 0 };
    }

    // 1. Update KPIs
    const totalGastos = calcTotalGastos(currentData);
    const beneficio = currentData.ingresos - totalGastos;
    
    kpiIngresos.textContent = formatCurrency(currentData.ingresos);
    kpiGastos.textContent = formatCurrency(totalGastos);
    kpiBeneficio.textContent = formatCurrency(beneficio);
    kpiAhorro.textContent = formatCurrency(currentData.ahorro);

    desgloseTitle.textContent = `Desglose ${formatMonth(currentMonthId)}`;

    // 2. Update Charts & Table
    updateDonutChart(currentData, totalGastos);
    updateHistoricalCharts(aggData);
    updateTable(aggData);
}

// ... the rest of the drawing functions remain almost exactly the same, pointing to aggData ...
function updateDonutChart(data, total) {
    const config = {
        labels: ['Compras', 'Restaurantes', 'Extra', 'Trabajo', 'Fijos'],
        values: [data.compras, data.restaurantes, data.extra, data.trabajo, data.fijos],
        colors: [colors.blue, colors.green, colors.orange, colors.red, colors.purple]
    };

    donutLegend.innerHTML = '';
    config.labels.forEach((label, i) => {
        const val = config.values[i];
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        const dotColor = ['dot-blue', 'dot-green', 'dot-orange', 'dot-red', 'dot-purple'][i];

        const row = document.createElement('div');
        row.className = 'd-legend-row';
        row.innerHTML = `
            <span class="dot ${dotColor}"></span>
            <span class="d-legend-label">${label}</span>
            <span class="d-legend-amount">${formatCurrency(val)}</span>
            <span class="d-legend-pct">(${pct}%)</span>
        `;
        donutLegend.appendChild(row);
    });

    if(donutChartInst) donutChartInst.destroy();
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: config.labels,
            datasets: [{ data: config.values, backgroundColor: config.colors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: €${c.raw.toFixed(2)}` } } }
        }
    });
}

function updateHistoricalCharts(aggData) {
    const labels = aggData.map(m => formatMonth(m.id));
    const ingresosData = aggData.map(m => m.ingresos);
    const gastosData = aggData.map(m => calcTotalGastos(m));

    if(lineChartInst) lineChartInst.destroy();
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInst = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos', data: ingresosData, borderColor: colors.blue, backgroundColor: colors.bgLineBlue, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHitRadius: 10 },
                { label: 'Gastos', data: gastosData, borderColor: colors.red, backgroundColor: colors.bgLineRed, borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHitRadius: 10 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: {size: 10, family: 'Inter'} } }, y: { grid: { color: '#F1F5F9' }, border: { display: false }, ticks: { callback: v => '€'+v, font: {size: 10, family: 'Inter'} } } }
        }
    });

    const dCompras = aggData.map(m => m.compras);
    const dRestaurantes = aggData.map(m => m.restaurantes);
    const dExtra = aggData.map(m => m.extra);
    const dTrabajo = aggData.map(m => m.trabajo);

    if(barChartInst) barChartInst.destroy();
    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChartInst = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Compras', data: dCompras, backgroundColor: colors.blue },
                { label: 'Comida Fuera', data: dRestaurantes, backgroundColor: colors.green },
                { label: 'Extra', data: dExtra, backgroundColor: colors.orange },
                { label: 'Trabajo', data: dTrabajo, backgroundColor: colors.red }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 12, font: {size: 10, family: 'Inter'} } }, y: { stacked: true, grid: { color: '#F1F5F9' }, border: { display: false }, ticks: { font: {size: 10, family: 'Inter'} } } }
        }
    });
}

function updateTable(aggData) {
    historyTableBody.innerHTML = '';
    const sorted = [...aggData].sort((a,b) => b.id.localeCompare(a.id));

    sorted.forEach(m => {
        const totalGastos = calcTotalGastos(m);
        const beneficio = m.ingresos - totalGastos;
        
        let benClass = beneficio >= 0 ? 'pill-green' : 'pill-red';
        let benText = formatCurrency(beneficio);
        if(beneficio < 0) benText = '-' + formatCurrency(Math.abs(beneficio));

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatMonth(m.id)}</td>
            <td>${formatCurrency(m.ingresos)}</td>
            <td class="col-roja-val">${formatCurrency(totalGastos)}</td>
            <td>${formatCurrency(m.fijos)}</td>
            <td>${formatCurrency(m.extra)}</td>
            <td><span class="${benClass}">${benText}</span></td>
        `;
        historyTableBody.appendChild(tr);
    });
}

// Start
init();
