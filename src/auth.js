// ==========================================
// CRM Tracker — Auth (Login Page)
// ==========================================

import { login } from './store-async.js';

function renderLogin() {
    // Attach login handler after render
    setTimeout(() => {
        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', handleLogin);
        }
    }, 0);

    return `
    <div class="login-page">
      <div class="login-card">
        <h1>CRM Tracker</h1>
        <p>Sign in to your account to continue</p>
        <form id="login-form">
          <div class="form-group">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" class="form-control"
                   placeholder="Enter your email" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" class="form-control"
                   placeholder="Enter your password" required autocomplete="current-password" />
          </div>
          <div id="login-error" style="color: var(--status-rejected); font-size: 0.82rem; margin-bottom: 12px; display: none;"></div>
          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px;" id="login-submit-btn">
            Sign In
          </button>
        </form>
        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color);">
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">Demo Accounts:</p>
          <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.8;">
            <strong style="color: var(--text-secondary);">Super Admin:</strong> superadmin@tracker.com / admin123<br>
            <strong style="color: var(--text-secondary);">Admin:</strong> admin@tracker.com / admin123<br>
            <strong style="color: var(--text-secondary);">Freelancer:</strong> safvan@tracker.com / freelancer123
          </div>
        </div>
      </div>
    </div>
  `;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const user = await login(email, password);
        if (user) {
            await window.renderApp();
        } else {
            errorEl.textContent = 'Invalid email or password';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = err.message || 'Login failed';
        errorEl.style.display = 'block';
    }
}

export { renderLogin };
