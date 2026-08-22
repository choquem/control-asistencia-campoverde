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
async function initReporte() {
    try {
        console.log('🔄 Cargando estudiantes...');
        const data = await loadStudents();
        students = data.students;
        console.log('✅ Estudiantes cargados:', students.length);
        
        console.log('🔄 Cargando asistencia...');
        attendanceData = await loadAttendanceFromSheet();
        console.log('✅ Asistencia cargada:', attendanceData.length);
        
        generateTeacherFilters(data.uniqueTeachers);
        renderWeekSelector();
        renderWeeklySummary();
        console.log('✅ Renderizado completado');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}
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
