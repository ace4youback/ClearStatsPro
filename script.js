// Global vars - typical human style
let chart = null;
let currentData = {};
let sortDirection = 'asc';
let currentChartType = 'bar';

// DOM elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusMsg = document.getElementById('status-msg');
const resultsSection = document.getElementById('results-section');
const dataTable = document.getElementById('data-table');
const searchInput = document.getElementById('search-input');

// Event listeners - human style with some redundancy
dropZone.onclick = () => fileInput.click();

dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
};

dropZone.ondragleave = () => {
    dropZone.classList.remove('drag-over');
};

dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
};

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
};

searchInput.oninput = filterTable;

// Main file handler - a bit messy like human code
async function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showStatus('File quá lớn! Tối đa 10MB', 'error');
        return;
    }

    showStatus('Đang xử lý file...', 'loading');
    
    try {
        let numbers = [];
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (ext === 'txt' || ext === 'csv') {
            const text = await file.text();
            // Simple regex to extract numbers
            const matches = text.match(/[\d,]+\.?\d*/g);
            if (matches) {
                numbers = matches.map(s => parseFloat(s.replace(/,/g, ''))).filter(n => !isNaN(n));
            }
        } else if (ext === 'xls' || ext === 'xlsx') {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, {header: 1});
            
            // Extract numbers from all cells
            jsonData.forEach(row => {
                row.forEach(cell => {
                    if (typeof cell === 'number') numbers.push(cell);
                });
            });
        }

        if (numbers.length === 0) {
            throw new Error('Không tìm thấy số liệu hợp lệ');
        }

        processNumbers(numbers, file.name);
        
    } catch (err) {
        showStatus('Lỗi: ' + err.message, 'error');
    }
}

// Process the numbers
function processNumbers(numbers, fileName) {
    const freq = {};
    let total = 0;
    
    // Count frequencies
    numbers.forEach(num => {
        freq[num] = (freq[num] || 0) + 1;
        total += num;
    });

    currentData = {
        frequencies: freq,
        total: total,
        count: numbers.length,
        avg: total / numbers.length,
        max: Math.max(...numbers),
        min: Math.min(...numbers),
        fileName: fileName
    };

    updateUI();
    saveHistory();
    showStatus(`Xử lý thành công ${numbers.length} mục từ ${fileName}`, 'success');
}

// Update all UI elements
function updateUI() {
    resultsSection.classList.remove('d-none');
    
    // Update stats cards
    document.getElementById('total-value').textContent = formatNumber(currentData.total) + 'k';
    document.getElementById('total-items').textContent = currentData.count.toLocaleString();
    document.getElementById('avg-value').textContent = formatNumber(currentData.avg) + 'k';
    document.getElementById('max-denomination').textContent = formatNumber(currentData.max) + 'k';
    document.getElementById('min-denomination').textContent = formatNumber(currentData.min) + 'k';

    updateChart();
    updateTable();
}

// Chart functions
function updateChart() {
    const ctx = document.getElementById('main-chart').getContext('2d');
    
    if (chart) chart.destroy();

    const sortedData = Object.entries(currentData.frequencies)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    
    const labels = sortedData.map(item => formatNumber(item[0]) + 'k');
    const data = sortedData.map(item => item[1]);

    const config = {
        type: currentChartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Số lần xuất hiện',
                data: data,
                backgroundColor: [
                    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: currentChartType === 'pie'
                }
            }
        }
    };

    chart = new Chart(ctx, config);
}

function changeChartType(type) {
    currentChartType = type;
    updateChart();
}

// Table functions  
function updateTable() {
    const sortedData = Object.entries(currentData.frequencies)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    
    dataTable.innerHTML = '';
    
    sortedData.forEach(([denom, count]) => {
        const subtotal = parseFloat(denom) * count;
        const percentage = ((subtotal / currentData.total) * 100).toFixed(1);
        
        const row = `
            <tr>
                <td>${formatNumber(denom)}k</td>
                <td>${count.toLocaleString()}</td>
                <td>${formatNumber(subtotal)}k</td>
                <td><span class="badge bg-primary">${percentage}%</span></td>
            </tr>
        `;
        dataTable.innerHTML += row;
    });
}

function filterTable() {
    const filter = searchInput.value.toLowerCase();
    const rows = dataTable.getElementsByTagName('tr');
    
    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    }
}

function sortTable(column) {
    // Simple sort implementation
    const rows = Array.from(dataTable.getElementsByTagName('tr'));
    
    rows.sort((a, b) => {
        const aVal = a.getElementsByTagName('td')[column].textContent;
        const bVal = b.getElementsByTagName('td')[column].textContent;
        
        if (column === 0) {
            return sortDirection === 'asc' ? 
                parseFloat(aVal) - parseFloat(bVal) : 
                parseFloat(bVal) - parseFloat(aVal);
        }
        return sortDirection === 'asc' ? 
            aVal.localeCompare(bVal) : 
            bVal.localeCompare(aVal);
    });
    
    dataTable.innerHTML = '';
    rows.forEach(row => dataTable.appendChild(row));
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
}

// Utility functions
function formatNumber(num) {
    return parseFloat(num).toLocaleString('vi-VN');
}

function showStatus(msg, type) {
    let className = 'alert-info';
    if (type === 'error') className = 'alert-danger';
    if (type === 'success') className = 'alert-success';
    
    statusMsg.innerHTML = `
        <div class="alert ${className} ${type === 'loading' ? 'loading-spinner' : ''}">${msg}</div>
    `;
    
    if (type !== 'loading') {
        setTimeout(() => statusMsg.innerHTML = '', 3000);
    }
}

// History functions - using localStorage
function saveHistory() {
    try {
        let history = JSON.parse(localStorage.getItem('fileHistory') || '[]');
        history.unshift({
            fileName: currentData.fileName,
            total: currentData.total,
            count: currentData.count,
            date: new Date().toLocaleString('vi-VN')
        });
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem('fileHistory', JSON.stringify(history));
        loadHistory();
    } catch (e) {
        // Ignore localStorage errors
    }
}

function loadHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('fileHistory') || '[]');
        const container = document.getElementById('history-container');
        
        if (history.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Chưa có dữ liệu...</p>';
            return;
        }
        
        container.innerHTML = history.map(item => `
            <div class="history-item mb-2">
                <div class="fw-bold">${item.fileName}</div>
                <small class="text-muted">${item.date}</small><br>
                <small>Tổng: ${formatNumber(item.total)}k (${item.count} mục)</small>
            </div>
        `).join('');
    } catch (e) {
        // Ignore localStorage errors
    }
}

// Export function
function exportData() {
    if (!currentData.frequencies) return;
    
    let csv = 'Mệnh giá,Số lần,Tổng,Phần trăm\n';
    Object.entries(currentData.frequencies).forEach(([denom, count]) => {
        const subtotal = parseFloat(denom) * count;
        const percentage = ((subtotal / currentData.total) * 100).toFixed(1);
        csv += `${denom},${count},${subtotal},${percentage}%\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thong-ke-menh-gia.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

// Clear all data
function clearAll() {
    if (confirm('Xóa tất cả dữ liệu?')) {
        resultsSection.classList.add('d-none');
        currentData = {};
        if (chart) chart.destroy();
        try {
            localStorage.removeItem('fileHistory');
        } catch (e) {}
        loadHistory();
        showStatus('Đã xóa tất cả dữ liệu', 'success');
    }
}

// Initialize
loadHistory();