// ==========================================
// CRM Tracker — Custom Date Picker
// ==========================================

import icons from './icons.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

let activePickerInput = null;
let pickerMonth = null;
let pickerYear = null;

function createPickerHTML(selectedDate) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const m = pickerMonth;
    const y = pickerYear;
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    // Day name headers
    const dayHeaders = DAY_NAMES.map(d => `<div class="dp-day-name">${d}</div>`).join('');

    // Previous month trailing
    let dayCells = '';
    for (let i = firstDay - 1; i >= 0; i--) {
        dayCells += `<div class="dp-day dp-other">${prevDays - i}</div>`;
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const classes = ['dp-day'];
        if (isToday) classes.push('dp-today');
        if (isSelected) classes.push('dp-selected');

        dayCells += `<div class="${classes.join(' ')}" data-date="${dateStr}" onclick="window.__dpSelectDate('${dateStr}')">${d}</div>`;
    }

    // Next month leading
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        dayCells += `<div class="dp-day dp-other">${i}</div>`;
    }

    return `
        <div class="dp-header">
            <button class="dp-nav" onclick="window.__dpChangeMonth(-1)" type="button">${icons.chevronLeft}</button>
            <div class="dp-title">
                <span class="dp-month-label">${MONTH_NAMES[m]}</span>
                <span class="dp-year-label">${y}</span>
            </div>
            <button class="dp-nav" onclick="window.__dpChangeMonth(1)" type="button">${icons.chevronRight}</button>
        </div>
        <div class="dp-grid">
            ${dayHeaders}
            ${dayCells}
        </div>
        <div class="dp-footer">
            <button class="dp-footer-btn" onclick="window.__dpSelectDate('${todayStr}')" type="button">Today</button>
            <button class="dp-footer-btn dp-clear-btn" onclick="window.__dpClear()" type="button">Clear</button>
        </div>
    `;
}

function openPicker(input) {
    closePicker();

    activePickerInput = input;
    const val = input.value;
    const d = val ? new Date(val) : new Date();
    pickerMonth = d.getMonth();
    pickerYear = d.getFullYear();

    const dropdown = document.createElement('div');
    dropdown.className = 'dp-dropdown';
    dropdown.id = 'dp-dropdown';
    dropdown.innerHTML = createPickerHTML(val);

    // Position relative to input
    const wrap = input.closest('.dp-wrap');
    if (wrap) {
        wrap.appendChild(dropdown);
    } else {
        // Fallback: absolute positioning
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(dropdown);
    }
}

function closePicker() {
    const existing = document.getElementById('dp-dropdown');
    if (existing) existing.remove();
    activePickerInput = null;
}

function refreshPicker() {
    const dropdown = document.getElementById('dp-dropdown');
    if (!dropdown || !activePickerInput) return;
    dropdown.innerHTML = createPickerHTML(activePickerInput.value);
}

// Global handlers
window.__dpSelectDate = function (dateStr) {
    if (!activePickerInput) return;
    activePickerInput.value = dateStr;
    // Trigger change event
    activePickerInput.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker();
};

window.__dpChangeMonth = function (delta) {
    pickerMonth += delta;
    if (pickerMonth > 11) { pickerMonth = 0; pickerYear++; }
    if (pickerMonth < 0) { pickerMonth = 11; pickerYear--; }
    refreshPicker();
};

window.__dpClear = function () {
    if (!activePickerInput) return;
    activePickerInput.value = '';
    activePickerInput.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker();
};

// Close on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dp-dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(e.target) && !e.target.classList.contains('dp-display')) {
        closePicker();
    }
});

/**
 * Enhance all date inputs on the page.
 * Call this after each render to convert native date inputs
 * into custom date pickers.
 */
export function enhanceDateInputs() {
    // Find all date inputs not yet enhanced
    document.querySelectorAll('input[type="date"]:not([data-dp-enhanced])').forEach(input => {
        input.setAttribute('data-dp-enhanced', '1');

        // Create wrapper
        const wrap = document.createElement('div');
        wrap.className = 'dp-wrap';
        wrap.style.cssText = input.style.cssText;
        input.style.cssText = '';

        input.parentElement.insertBefore(wrap, input);

        // Create display button
        const display = document.createElement('div');
        display.className = 'dp-display form-control';
        if (input.id) display.setAttribute('data-for', input.id);

        function updateDisplay() {
            if (input.value) {
                const d = new Date(input.value + 'T00:00:00');
                display.innerHTML = `${icons.calendar} <span>${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}</span>`;
                display.classList.add('dp-has-value');
            } else {
                display.innerHTML = `${icons.calendar} <span style="color:var(--text-muted);">Select date</span>`;
                display.classList.remove('dp-has-value');
            }
        }
        updateDisplay();

        display.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.getElementById('dp-dropdown') && activePickerInput === input) {
                closePicker();
            } else {
                openPicker(input);
            }
        });

        // Listen for value changes
        input.addEventListener('change', updateDisplay);

        // Hide the original input but keep it in DOM for form value
        input.type = 'hidden';

        wrap.appendChild(input);
        wrap.appendChild(display);
    });
}

// Auto-enhance date inputs added to the DOM (e.g. from modals)
const dpObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
                if (node.matches && node.matches('input[type="date"]:not([data-dp-enhanced])')) {
                    enhanceDateInputs();
                    return;
                }
                if (node.querySelectorAll && node.querySelectorAll('input[type="date"]:not([data-dp-enhanced])').length > 0) {
                    enhanceDateInputs();
                    return;
                }
            }
        }
    }
});
dpObserver.observe(document.body, { childList: true, subtree: true });
