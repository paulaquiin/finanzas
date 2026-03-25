const STORAGE_KEY = 'finanzas_monthly_v1';
let monthlyData = [];
let currentMonthId = '';

// DOM Elements
const monthSelector = document.getElementById('monthSelector');
const editDataBtn = document.getElementById('editDataBtn');

const kpiIngresos = document.getElementById('kpiIngresos');
const kpiGastos = document.getElementById('kpiGastos');
const kpiBeneficio = document.getElementById('kpiBeneficio');
const kpiAhorro = document.getElementById('kpiAhorro');

const desgloseTitle = document.getElementById('desgloseTitle');
const donutLegend = document.getElementById('donutLegend');
const historyTableBody = document.querySelector('#historyTable tbody');

// Modal Elements
const editModal = document.getElementById('editModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const dataForm = document.getElementById('dataForm');
const modalTitle = document.getElementById('modalTitle');
const deleteMonthBtn = document.getElementById('deleteMonthBtn');

// Form Inputs
const formMonthDate = document.getElementById('formMonthDate');
const formIngresos = document.getElementById('formIngresos');
const formAhorro = document.getElementById('formAhorro');
const formFijos = document.getElementById('formFijos');
const formCompras = document.getElementById('formCompras');
const formRestaurantes = document.getElementById('formRestaurantes');
const formExtra = document.getElementById('formExtra');
const formTrabajo = document.getElementById('formTrabajo');

// Charts
let lineChartInst, donutChartInst, barChartInst;

// Colors matching CSS
const colors = {
    blue: '#4A72FF',
    red: '#FF4A57',
    green: '#10B981',
    purple: '#9A55FF',
    orange: '#FF9F24',
    bgLineBlue: 'rgba(74, 114, 255, 0.1)',
    bgLineRed: 'rgba(255, 74, 87, 0.1)'
};

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// --- INITIALIZATION ---
function init() {
    loadData();
    
    // Listeners
    monthSelector.addEventListener('change', (e) => {
        currentMonthId = e.target.value;
        updateUI();
    });

    editDataBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    deleteMonthBtn.addEventListener('click', deleteCurrentMonth);
    dataForm.addEventListener('submit', handleSaveData);
    formMonthDate.addEventListener('change', autoFillFormFromDate);

    // Initial Render
    if(monthlyData.length > 0) {
        // Set to latest month
        monthlyData.sort((a,b) => a.id.localeCompare(b.id)); // YYYY-MM
        currentMonthId = monthlyData[monthlyData.length - 1].id;
    } else {
        const d = new Date();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        currentMonthId = `${d.getFullYear()}-${m}`;
    }

    renderMonthSelector();
    updateUI();
}

function generateDummyData() {
    const data = [
        { id: '2024-03', ingresos: 810.91, ahorro: 0, fijos: 1015.82, compras: 300, restaurantes: 200, extra: 68.80, trabajo: 345.92 },
        { id: '2026-02', ingresos: 1896.58, ahorro: 0, fijos: 1061.50, compras: 450, restaurantes: 300, extra: 270.22, trabajo: 186.92 },
        { id: '2026-03', ingresos: 4000.00, ahorro: 500, fijos: 1336.50, compras: 365.35, restaurantes: 217.33, extra: 689.95, trabajo: 78.24 }
    ];

    // Add some random historical data between 2024 and 2026 to make charts look nice like the mock
    const all = [...data];
    let d = new Date('2024-04-01');
    const end = new Date('2026-02-01');
    while(d < end) {
        const id = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
        all.push({
            id,
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
    return all.sort((a,b) => a.id.localeCompare(b.id));
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        monthlyData = generateDummyData();
        saveData();
    } else {
        monthlyData = JSON.parse(saved);
        monthlyData.sort((a,b) => a.id.localeCompare(b.id));
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(monthlyData));
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

// --- UI UPDATES ---
function renderMonthSelector() {
    monthSelector.innerHTML = '';
    const sorted = [...monthlyData].sort((a,b) => b.id.localeCompare(a.id)); // Newest first
    sorted.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = formatMonth(m.id);
        if(m.id === currentMonthId) opt.selected = true;
        monthSelector.appendChild(opt);
    });
}

function updateUI() {
    if(!monthlyData.length) return;
    
    // Find current data
    let currentData = monthlyData.find(m => m.id === currentMonthId);
    if(!currentData) {
        currentData = monthlyData[monthlyData.length - 1];
        currentMonthId = currentData.id;
        monthSelector.value = currentMonthId;
    }

    // 1. Update KPIs
    const totalGastos = calcTotalGastos(currentData);
    const beneficio = currentData.ingresos - totalGastos;
    
    kpiIngresos.textContent = formatCurrency(currentData.ingresos);
    kpiGastos.textContent = formatCurrency(totalGastos);
    kpiBeneficio.textContent = formatCurrency(beneficio);
    kpiAhorro.textContent = formatCurrency(currentData.ahorro);

    desgloseTitle.textContent = `Desglose ${formatMonth(currentMonthId)}`;

    // 2. Update Donut Chart
    updateDonutChart(currentData, totalGastos);

    // 3. Update Line / Bar Charts (they use ALL data)
    updateHistoricalCharts();

    // 4. Update Table (uses ALL data, newest first)
    updateTable();
}

function updateDonutChart(data, total) {
    const config = {
        labels: ['Compras', 'Restaurantes', 'Extra', 'Trabajo', 'Fijos'],
        values: [data.compras, data.restaurantes, data.extra, data.trabajo, data.fijos],
        colors: [colors.blue, colors.green, colors.orange, colors.red, colors.purple]
    };

    // Render legend HTML
    donutLegend.innerHTML = '';
    config.labels.forEach((label, i) => {
        const val = config.values[i];
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        
        // Find dot class
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

    // Render Chart JS
    if(donutChartInst) donutChartInst.destroy();
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: config.labels,
            datasets: [{
                data: config.values,
                backgroundColor: config.colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: €${context.raw.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateHistoricalCharts() {
    const labels = monthlyData.map(m => formatMonth(m.id));
    const ingresosData = monthlyData.map(m => m.ingresos);
    const gastosData = monthlyData.map(m => calcTotalGastos(m));

    // 1. Line Chart
    if(lineChartInst) lineChartInst.destroy();
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInst = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: ingresosData,
                    borderColor: colors.blue,
                    backgroundColor: colors.bgLineBlue,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 10
                },
                {
                    label: 'Gastos',
                    data: gastosData,
                    borderColor: colors.red,
                    backgroundColor: colors.bgLineRed,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { maxTicksLimit: 8, font: {size: 10, family: 'Inter'} }
                },
                y: { 
                    grid: { color: '#F1F5F9' },
                    border: { display: false },
                    ticks: { callback: (val) => '€' + val, font: {size: 10, family: 'Inter'} }
                }
            }
        }
    });

    // 2. Bar Chart (Variable expenses stacked)
    const dCompras = monthlyData.map(m => m.compras);
    const dRestaurantes = monthlyData.map(m => m.restaurantes);
    const dExtra = monthlyData.map(m => m.extra);
    const dTrabajo = monthlyData.map(m => m.trabajo);

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
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    stacked: true, 
                    grid: { display: false },
                    ticks: { maxTicksLimit: 12, font: {size: 10, family: 'Inter'} }
                },
                y: { 
                    stacked: true, 
                    grid: { color: '#F1F5F9' },
                    border: { display: false },
                    ticks: { font: {size: 10, family: 'Inter'} }
                }
            }
        }
    });
}

function updateTable() {
    historyTableBody.innerHTML = '';
    const sorted = [...monthlyData].sort((a,b) => b.id.localeCompare(a.id));

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

// --- MODAL AND FORM LOGIC ---
function openModal() {
    formMonthDate.value = currentMonthId;
    autoFillFormFromDate();
    editModal.classList.add('active');
}

function closeModal() {
    editModal.classList.remove('active');
}

function autoFillFormFromDate() {
    const targetId = formMonthDate.value; // YYYY-MM
    modalTitle.textContent = `Mes: ${formatMonth(targetId) || 'Nuevo'}`;
    
    const existing = monthlyData.find(m => m.id === targetId);
    
    if (existing) {
        formIngresos.value = existing.ingresos;
        formAhorro.value = existing.ahorro;
        formFijos.value = existing.fijos;
        formCompras.value = existing.compras;
        formRestaurantes.value = existing.restaurantes;
        formExtra.value = existing.extra;
        formTrabajo.value = existing.trabajo;
        deleteMonthBtn.style.display = 'block';
    } else {
        formIngresos.value = 0;
        formAhorro.value = 0;
        formFijos.value = 0;
        formCompras.value = 0;
        formRestaurantes.value = 0;
        formExtra.value = 0;
        formTrabajo.value = 0;
        deleteMonthBtn.style.display = 'none';
    }
}

function handleSaveData(e) {
    e.preventDefault();
    
    const targetId = formMonthDate.value;
    if(!targetId) return;

    const dataObj = {
        id: targetId,
        ingresos: parseFloat(formIngresos.value) || 0,
        ahorro: parseFloat(formAhorro.value) || 0,
        fijos: parseFloat(formFijos.value) || 0,
        compras: parseFloat(formCompras.value) || 0,
        restaurantes: parseFloat(formRestaurantes.value) || 0,
        extra: parseFloat(formExtra.value) || 0,
        trabajo: parseFloat(formTrabajo.value) || 0
    };

    const idx = monthlyData.findIndex(m => m.id === targetId);
    if(idx >= 0) {
        monthlyData[idx] = dataObj;
    } else {
        monthlyData.push(dataObj);
    }

    saveData();
    currentMonthId = targetId; // set view to edited month
    
    // Refresh selector and UI
    renderMonthSelector();
    updateUI();
    closeModal();
}

function deleteCurrentMonth() {
    const targetId = formMonthDate.value;
    if(confirm(`¿Estás seguro de que deseas eliminar los datos de ${formatMonth(targetId)}?`)) {
        monthlyData = monthlyData.filter(m => m.id !== targetId);
        saveData();
        
        if(monthlyData.length > 0) {
            monthlyData.sort((a,b) => a.id.localeCompare(b.id)); 
            currentMonthId = monthlyData[monthlyData.length - 1].id;
        } else {
            currentMonthId = ''; // will cause issues but UI gracefully ignores if empty
        }
        
        renderMonthSelector();
        updateUI();
        closeModal();
    }
}

// Start app
init();
