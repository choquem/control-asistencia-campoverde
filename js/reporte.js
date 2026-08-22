// ============================================
// FUNCIONES - PÁGINA DE REPORTE
// ============================================

let students = [];
let attendanceData = [];
let selectedWeek = 0;
let summaryTeacherFilter = 'todos';
let attendanceColorFilter = 'todos';

// ============================================
// INICIALIZACIÓN
// ============================================

// Verificar autenticación al cargar
if (!checkAuth()) {
    // Si no hay sesión, ya fue redirigido por checkAuth()
} else {
    // Generar navegación
    document.getElementById('navbar').innerHTML = generateNavigation('reporte');
    
    // Inicializar página
    initReporte();
}

async function initReporte() {
    try {
        const data = await loadStudents();
        students = data.students;
        
        generateTeacherFilters(data.uniqueTeachers);
        attendanceData = await loadAttendanceFromSheet();
        
        renderWeekSelector();
        renderWeeklySummary();
    } catch (error) {
        console.error('Error inicializando reporte:', error);
    }
}

// ============================================
// FILTROS POR MAESTRO
// ============================================

function generateTeacherFilters(teachers) {
    const container = document.getElementById('summaryTeacherFilters');
    teachers.forEach(teacher => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = teacher;
        btn.onclick = () => filterSummaryByTeacher(teacher);
        container.appendChild(btn);
    });
}

function filterSummaryByTeacher(teacher) {
    summary
