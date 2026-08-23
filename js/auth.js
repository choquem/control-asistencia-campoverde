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
    
    // Botón Registro (solo para admin)
    if (user.role === 'admin') {
        navLinks += '<a href="registro.html" class="nav-link ' + (activePage === 'registro' ? 'active' : '') + '">📝 Registro</a>';
    }
    
    // Botón Reporte
    navLinks += '<a href="reporte.html" class="nav-link ' + (activePage === 'reporte' ? 'active' : '') + '">📊 Reporte</a>';
    
    // ✅ Botón Compensación (SOLO en página de Reporte)
    if (activePage === 'reporte') {
        navLinks += '<a href="https://banksy.padletcdn.com/export/pdf?delay=1000&eurl=JTdwcxIZwvo%2BOun%2F7uStBgt8M6asuVoF%2BVrPBC%2FBX%2Bk572VoehqErMkSd39kaNlQZkOmtSsH88Z%2BXxGxcdOzbbm5ViL1r9U%2Bhn%2B5Iz2iWjzIgJAd9T%2Ff7RUc%2FzL5oPCHtzwCFD32RgDmItFXvsvQ2bcwB4Y6JsYKn4QjabIzm%2FsjBXx7Y1ISbj4QqniFzOk1kb8eoCBfKVFMJ1KlcGq2zJQ4Rh%2BDdFRgazdKWBbYsWLCX8%2FyzesFvwbkyXgZqGhd&filename=Padlet+-+Compensaciones+ANTIGUO+TESTAMENTO+2026+++2do+Periodo&margin_bottom=28&margin_left=32&margin_right=32&margin_top=28&orientation=portrait&page_size=a4&timeout=25000&wait_for_selector=&wait_for_wishes=true" target="_blank" class="nav-link compensacion-btn">💰 Compensación</a>';
    }
    
    // Botón Cerrar Sesión
    navLinks += '<button class="btn-logout" onclick="logout()">🚪 Cerrar Sesión</button>';
    
    return '<nav class="navbar">' +
        '<a href="' + (user.role === 'admin' ? 'registro.html' : 'reporte.html') + '" class="nav-brand">📋 Control de Asistencia</a>' +
        '<div class="nav-links">' + navLinks + '</div>' +
        '<div style="font-size: 0.85rem; color: #666; margin-left: 10px;">' + user.name + ' (' + user.role + ')</div>' +
    '</nav>';
}
