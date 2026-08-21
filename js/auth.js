// ============================================
// SISTEMA DE AUTENTICACIÓN
// ============================================

const USERS = {
    admin: { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' },
    invitado: { username: 'invitado', password: 'invitado123', role: 'invitado', name: 'Invitado' }
};

function checkAuth() {
    const session = localStorage.getItem('authSession');
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    
    try {
        return JSON.parse(session);
    } catch (error) {
        localStorage.removeItem('authSession');
        window.location.href = 'index.html';
        return null;
    }
}

function requireAdmin() {
    const user = checkAuth();
    if (!user) return false;
    
    if (user.role !== 'admin') {
        alert('⚠️ No tienes permisos de administrador');
        window.location.href = 'reporte.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('authSession');
    window.location.href = 'index.html';
}

function getCurrentUser() {
    const session = localStorage.getItem('authSession');
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch (error) {
        return null;
    }
}

function generateNavigation(activePage = 'registro') {
    const user = getCurrentUser();
    if (!user) return '';
    
    let navLinks = '';
    
    if (user.role === 'admin') {
        navLinks += `<a href="registro.html" class="nav-link ${activePage === 'registro' ? 'active' : ''}">✅ Registro</a>`;
    }
    
    navLinks += `<a href="reporte.html" class="nav-link ${activePage === 'reporte' ? 'active' : ''}">📊 Reporte</a>`;
    navLinks += `<button class="btn-logout" onclick="logout()">🚪 Cerrar Sesión</button>`;
    
    return `
        <nav class="navbar">
            <a href="${user.role === 'admin' ? 'registro.html' : 'reporte.html'}" class="nav-brand">📋 Control de Asistencia</a>
            <div class="nav-links">
                ${navLinks}
            </div>
            <div style="font-size: 0.85rem; color: #666; margin-left: 10px;">
                👤 ${user.name} (${user.role})
            </div>
        </nav>
    `;
}