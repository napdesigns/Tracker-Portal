// ==========================================
// CRM Tracker — Analytics Dashboard Page
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getFreelancers,
    getStats, MONTHS, formatDate,
} from './store-async.js';
import icons from './icons.js';

async function renderAnalytics() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const allTasks = await getTasks();
    const freelancers = adminUser ? await getFreelancers() : [];

    // ---- Data Preparation ----

    // Monthly task counts (current year)
    const currentYear = new Date().getFullYear();
    const monthlyData = MONTHS.map((m, i) => {
        const monthTasks = allTasks.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === i && d.getFullYear() === currentYear;
        });
        return {
            month: m,
            total: monthTasks.length,
            approved: monthTasks.filter(t => t.status === 'approved').length,
            revenue: monthTasks.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        };
    });

    // Status distribution
    const statusCounts = {
        assigned: allTasks.filter(t => t.status === 'assigned').length,
        in_progress: allTasks.filter(t => t.status === 'in_progress').length,
        submitted: allTasks.filter(t => t.status === 'submitted').length,
        approved: allTasks.filter(t => t.status === 'approved').length,
        iteration: allTasks.filter(t => t.status === 'iteration').length,
        rejected: allTasks.filter(t => t.status === 'rejected').length,
    };

    // Type distribution
    const typeCounts = {};
    allTasks.forEach(t => {
        typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
    });

    // Payment distribution
    const paymentCounts = {
        Paid: allTasks.filter(t => t.paymentStatus === 'Paid').length,
        Pending: allTasks.filter(t => t.paymentStatus === 'Pending').length,
        Unpaid: allTasks.filter(t => !t.paymentStatus || t.paymentStatus === 'Unpaid').length,
    };

    // Freelancer performance (admin only)
    let freelancerPerformanceHTML = '';
    if (adminUser && freelancers.length > 0) {
        const freelancerData = freelancers.map(f => {
            const fTasks = allTasks.filter(t => t.assignedTo === f.id);
            const approved = fTasks.filter(t => t.status === 'approved').length;
            const totalIter = fTasks.reduce((sum, t) => sum + (t.iterations || []).length, 0);
            const revenue = fTasks.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            return { name: f.name, tasks: fTasks.length, approved, iterations: totalIter, revenue };
        }).sort((a, b) => b.tasks - a.tasks);

        const maxTasks = Math.max(...freelancerData.map(f => f.tasks), 1);

        freelancerPerformanceHTML = `
      <div class="analytics-card">
        <h3>Freelancer Performance</h3>
        <div class="analytics-bar-chart">
          ${freelancerData.map(f => `
            <div class="bar-row">
              <div class="bar-label">${f.name}</div>
              <div class="bar-track">
                <div class="bar-fill purple" style="width: ${(f.tasks / maxTasks) * 100}%"></div>
              </div>
              <div class="bar-value">${f.tasks} tasks</div>
            </div>
          `).join('')}
        </div>
        <div class="table-container" style="margin-top: 16px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Freelancer</th>
                <th>Tasks</th>
                <th>Approved</th>
                <th>Iterations</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${freelancerData.map(f => `
                <tr>
                  <td><strong>${f.name}</strong></td>
                  <td>${f.tasks}</td>
                  <td>${f.approved}</td>
                  <td>${f.iterations}</td>
                  <td>₹${f.revenue.toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    // Overdue tasks
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = allTasks.filter(t =>
        t.dueDate && t.dueDate < today &&
        !['approved', 'rejected'].includes(t.status)
    );

    // ---- Render Charts ----

    // Monthly bar chart
    const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1);
    const monthlyChartHTML = monthlyData.map(m => `
    <div class="chart-bar-col">
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height: ${(m.total / maxMonthly) * 100}%">
          <span class="chart-bar-tooltip">${m.total}</span>
        </div>
      </div>
      <div class="chart-bar-label">${m.month}</div>
    </div>
  `).join('');

    // Revenue trend
    const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);
    const revenueChartHTML = monthlyData.map(m => `
    <div class="chart-bar-col">
      <div class="chart-bar-wrapper">
        <div class="chart-bar teal" style="height: ${(m.revenue / maxRevenue) * 100}%">
          <span class="chart-bar-tooltip">₹${m.revenue.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div class="chart-bar-label">${m.month}</div>
    </div>
  `).join('');

    // Status donut
    const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
    const statusItems = [
        { label: 'Assigned', count: statusCounts.assigned, color: 'var(--status-assigned)' },
        { label: 'In Progress', count: statusCounts.in_progress, color: 'var(--status-in-progress)' },
        { label: 'Submitted', count: statusCounts.submitted, color: 'var(--status-submitted)' },
        { label: 'Approved', count: statusCounts.approved, color: 'var(--status-approved)' },
        { label: 'Iteration', count: statusCounts.iteration, color: 'var(--status-iteration)' },
        { label: 'Rejected', count: statusCounts.rejected, color: 'var(--status-rejected)' },
    ];

    let cumulativePercent = 0;
    const donutSegments = statusItems.filter(s => s.count > 0).map(s => {
        const pct = (s.count / statusTotal) * 100;
        const segment = `${s.color} ${cumulativePercent}% ${cumulativePercent + pct}%`;
        cumulativePercent += pct;
        return segment;
    }).join(', ');

    // Type breakdown
    const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const maxType = Math.max(...typeEntries.map(e => e[1]), 1);

    // Payment donut
    const payTotal = Object.values(paymentCounts).reduce((a, b) => a + b, 0) || 1;
    const payItems = [
        { label: 'Paid', count: paymentCounts.Paid, color: 'var(--payment-paid)' },
        { label: 'Pending', count: paymentCounts.Pending, color: 'var(--payment-pending)' },
        { label: 'Unpaid', count: paymentCounts.Unpaid, color: 'var(--payment-unpaid)' },
    ];
    let payCumulative = 0;
    const payDonutSegments = payItems.filter(s => s.count > 0).map(s => {
        const pct = (s.count / payTotal) * 100;
        const segment = `${s.color} ${payCumulative}% ${payCumulative + pct}%`;
        payCumulative += pct;
        return segment;
    }).join(', ');

    return `
    <div class="page-header">
      <h1>Analytics</h1>
      <span style="color: var(--text-secondary); font-size: 0.85rem;">${currentYear} Overview</span>
    </div>
    <div class="page-body">
      <!-- Top Stats -->
      <div class="stat-cards">
        <div class="stat-card purple">
          <div class="stat-icon">${icons.barChart}</div>
          <div class="stat-value">${allTasks.length}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">${icons.checkCircle}</div>
          <div class="stat-value">${statusCounts.approved}</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card teal">
          <div class="stat-icon">${icons.dollarSign}</div>
          <div class="stat-value">₹${allTasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0).toLocaleString('en-IN')}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">${icons.alertTriangle}</div>
          <div class="stat-value">${overdueTasks.length}</div>
          <div class="stat-label">Overdue Tasks</div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="analytics-grid">
        <!-- Monthly Tasks -->
        <div class="analytics-card">
          <h3>Monthly Tasks (${currentYear})</h3>
          <div class="chart-bar-container">${monthlyChartHTML}</div>
        </div>

        <!-- Monthly Revenue -->
        <div class="analytics-card">
          <h3>Monthly Revenue (${currentYear})</h3>
          <div class="chart-bar-container">${revenueChartHTML}</div>
        </div>

        <!-- Status Distribution -->
        <div class="analytics-card">
          <h3>Task Status Distribution</h3>
          <div class="donut-chart-wrapper">
            <div class="donut-chart" style="background: conic-gradient(${donutSegments || 'var(--bg-input) 0% 100%'});">
              <div class="donut-hole">${statusTotal > 1 ? statusTotal : 0}</div>
            </div>
            <div class="donut-legend">
              ${statusItems.filter(s => s.count > 0).map(s => `
                <div class="legend-item">
                  <span class="legend-dot" style="background: ${s.color};"></span>
                  <span class="legend-label">${s.label}</span>
                  <span class="legend-value">${s.count} (${Math.round((s.count / statusTotal) * 100)}%)</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Payment Distribution -->
        <div class="analytics-card">
          <h3>Payment Status</h3>
          <div class="donut-chart-wrapper">
            <div class="donut-chart" style="background: conic-gradient(${payDonutSegments || 'var(--bg-input) 0% 100%'});">
              <div class="donut-hole">${payTotal > 1 ? payTotal : 0}</div>
            </div>
            <div class="donut-legend">
              ${payItems.filter(s => s.count > 0).map(s => `
                <div class="legend-item">
                  <span class="legend-dot" style="background: ${s.color};"></span>
                  <span class="legend-label">${s.label}</span>
                  <span class="legend-value">${s.count} (${Math.round((s.count / payTotal) * 100)}%)</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Task Types -->
        <div class="analytics-card">
          <h3>Task Types</h3>
          <div class="analytics-bar-chart">
            ${typeEntries.map(([type, count]) => `
              <div class="bar-row">
                <div class="bar-label">${type}</div>
                <div class="bar-track">
                  <div class="bar-fill teal" style="width: ${(count / maxType) * 100}%"></div>
                </div>
                <div class="bar-value">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Freelancer Performance -->
        ${freelancerPerformanceHTML}
      </div>
    </div>
  `;
}

export { renderAnalytics };
