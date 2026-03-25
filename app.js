// --- CONSTANTS & STATE ---
const STORAGE_KEY = 'finanzas_data_v1';
let transactions = [];
let currentDate = new Date(); // Starts at current month

// DOM Elements
const currentMonthDisplay = document.getElementById('currentMonthDisplay');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

const balanceAmount = document.getElementById('balanceAmount');
const incomeAmount = document.getElementById('incomeAmount');
const expenseAmount = document.getElementById('expenseAmount');

const transactionsList = document.getElementById('transactionsList');

const modal = document.getElementById('transactionModal');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const transactionForm = document.getElementById('transactionForm');


// Form Elements
const formAmount = document.getElementById('amount');
const formCategory = document.getElementById('category');
const formDate = document.getElementById('date');
const formDesc = document.getElementById('description');

// --- ICONS MAPPING ---
const categoryIcons = {
    'housing': 'fa-house',
    'food': 'fa-utensils',
    'transport': 'fa-car',
    'leisure': 'fa-ticket',
    'salary': 'fa-money-bill-wave',
    'others': 'fa-cubes'
};
const categoryNames = {
    'housing': 'Vivienda',
    'food': 'Alimentación',
    'transport': 'Transporte',
    'leisure': 'Ocio',
    'salary': 'Sueldo / Nómina',
    'others': 'Otros'
};

// --- INITIALIZATION ---
function init() {
    loadTransactions();
    
    // Set default date in form to today
    formDate.valueAsDate = new Date();

    // Event Listeners
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    
    addTransactionBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    transactionForm.addEventListener('submit', handleAddTransaction);

    updateUI();
}

// --- DATA MANAGEMENT ---
function loadTransactions() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        transactions = JSON.parse(saved);
        // Clean types potentially
        transactions.forEach(t => t.date = new Date(t.date));
    }
}

function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// --- UI UPDATES ---
function updateUI() {
    updateMonthDisplay();
    
    const filtered = getTransactionsForCurrentMonth();
    
    renderSummary(filtered);
    renderTransactionsList(filtered);
}

function updateMonthDisplay() {
    const options = { month: 'long', year: 'numeric' };
    const formatted = currentDate.toLocaleDateString('es-ES', options);
    // Capitalize first letter
    currentMonthDisplay.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getTransactionsForCurrentMonth() {
    return transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentDate.getMonth() && 
               d.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
}

function renderSummary(filteredTransactions) {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expense += t.amount;
    });

    const balance = income - expense;

    incomeAmount.textContent = formatCurrency(income);
    expenseAmount.textContent = formatCurrency(expense);
    balanceAmount.textContent = formatCurrency(balance);
    
    // Dynamic color for balance
    balanceAmount.className = 'amount ' + (balance >= 0 ? 'positive' : 'negative');
}

function renderTransactionsList(filteredTransactions) {
    transactionsList.innerHTML = '';

    if (filteredTransactions.length === 0) {
        transactionsList.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>No hay transacciones este mes.</p>
            </div>
        `;
        return;
    }

    filteredTransactions.forEach(t => {
        const div = document.createElement('div');
        div.className = `transaction-item t-item-${t.type}`;

        const iconClass = categoryIcons[t.category] || 'fa-circle-question';
        const catName = categoryNames[t.category] || 'Desconocido';
        const symbol = t.type === 'income' ? '+' : '-';

        // Format Date roughly: "14 Ene"
        const dateStr = new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        div.innerHTML = `
            <div class="t-left">
                <div class="t-icon">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="t-info">
                    <h4>${t.description}</h4>
                    <p>${catName} • ${dateStr}</p>
                </div>
            </div>
            <div class="t-right">
                <div class="t-amount">${symbol}${formatCurrency(t.amount)}</div>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')" title="Eliminar">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        transactionsList.appendChild(div);
    });
}

// --- ACTIONS ---
function handleAddTransaction(e) {
    e.preventDefault();

    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseFloat(formAmount.value);
    const category = formCategory.value;
    const date = formDate.value;
    const description = formDesc.value;

    const newTransaction = {
        id: crypto.randomUUID(), // Standard UUID for unique ID
        type,
        amount,
        category,
        date: new Date(date).toISOString(),
        description
    };

    transactions.push(newTransaction);
    saveTransactions();
    
    // Automatically switch the view to the month of the added transaction
    const tDate = new Date(date);
    if(tDate.getMonth() !== currentDate.getMonth() || tDate.getFullYear() !== currentDate.getFullYear()) {
         currentDate = new Date(tDate.getFullYear(), tDate.getMonth(), 1);
    }

    updateUI();
    closeModal();
    transactionForm.reset();
    formDate.valueAsDate = new Date(); // Reset date to today
}

window.deleteTransaction = function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        updateUI();
    }
}

function changeMonth(direction) {
    // direction is 1 (next) or -1 (prev)
    currentDate.setMonth(currentDate.getMonth() + direction);
    updateUI();
}

// --- UTILS ---
function formatCurrency(num) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
}

// Start
init();
