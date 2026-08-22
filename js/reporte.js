// ============================================
// FUNCIONES - PÁGINA DE REPORTE
// ============================================

let students = [];
let attendanceData = [];
let selectedWeek = 0;
let summaryTeacherFilter = 'todos';

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
    summaryTeacherFilter = teacher;
    document.querySelectorAll('#summaryTeacherFilters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (teacher === 'todos' && btn.textContent.includes('Todos')) btn.classList.add('active');
        else if (btn.textContent === teacher) btn.classList.add('active');
    });
    renderWeeklySummary();
}

function renderWeekSelector() {
    const selector = document.getElementById('weekSelector');
    selector.innerHTML = '';
    for (let i = 0; i >= -3; i--) {
        const btn = document.createElement('button');
        btn.className = 'week-btn' + (i === selectedWeek ? ' active' : '');
        btn.textContent = i === 0 ? '📅 Esta Semana' : i === -1 ? '⏪ Semana Pasada' : `Semana ${i}`;
        btn.onclick = () => {
            selectedWeek = i;
            document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderWeeklySummary();
        };
        selector.appendChild(btn);
    }
}

function renderWeeklySummary() {
    const days = getWeekDays(selectedWeek);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    
    document.getElementById('weekRange').textContent = `📆 ${firstDay.fullDate} - ${lastDay.fullDate} (${firstDay.name} a ${lastDay.name})`;

    const filteredStudents = summaryTeacherFilter === 'todos' ? students : students.filter(s => s.maestro === summaryTeacherFilter);

    // TABLA NORMAL (para desktop)
    let html = `<table class="summary-table"><thead><tr><th>Alumno</th>`;
    days.forEach(day => {
        html += `<th><div class="day-header">${day.name}</div><div class="date-sub">${day.fullDate}</div></th>`;
    });
    html += `<th>Asistencia</th></tr></thead><tbody>`;

    filteredStudents.forEach((student, index) => {
        // Calcular asistencia individual
        let diasAsistidos = 0;
        let diasTotales = 0;
        
        days.forEach(day => {
            const allRecords = attendanceData.filter(r => r.nombre === student.nombre && r.fecha === day.date);
            const bestStatus = getBestStatus(allRecords);
            
            if (bestStatus) {
                diasTotales++;
                if (bestStatus === 'presente' || bestStatus === 'tardanza') {
                    diasAsistidos++;
                }
            }
        });
        
        const porcentaje = diasTotales > 0 ? Math.round((diasAsistidos / diasTotales) * 100) : 0;
        
        // Color según porcentaje
        let colorClase = 'low';
        if (porcentaje >= 75) colorClase = 'high';
        else if (porcentaje >= 55) colorClase = 'medium';
        
        html += `<tr><td>${index + 1}. ${student.nombre}</td>`;
        days.forEach(day => {
            const allRecords = attendanceData.filter(r => r.nombre === student.nombre && r.fecha === day.date);
            const bestStatus = getBestStatus(allRecords);
            
            let cellContent = '<span style="color: #ccc;">—</span>';
            if (bestStatus === 'presente') cellContent = '✅';
            else if (bestStatus === 'ausente') cellContent = '❌';
            else if (bestStatus === 'tardanza') cellContent = '⏰';
            
            html += `<td>${cellContent}</td>`;
        });
        
        // Columna de porcentaje
        html += `<td class="attendance-cell ${colorClase}"><strong>${porcentaje}%</strong></td>`;
        html += `</tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('weeklySummaryTable').innerHTML = html;

    // Estadísticas generales
    const weekDates = days.map(d => d.date);
    const weekData = attendanceData.filter(r => {
        const isInWeek = weekDates.includes(r.fecha);
        const isInFilter = summaryTeacherFilter === 'todos' ? true : filteredStudents.some(s => s.nombre === r.nombre);
        return isInWeek && isInFilter;
    });
    
    const total = weekData.length;
    const presentes = weekData.filter(r => r.estado === 'presente').length;
    const ausentes = weekData.filter(r => r.estado === 'ausente').length;
    const tardanzas = weekData.filter(r => r.estado === 'tardanza').length;
    const porcentaje = total > 0 ? Math.round(((presentes + tardanzas) / total) * 100) : 0;

    document.getElementById('statsRow').innerHTML = `
        <div class="stat-mini" style="background: linear-gradient(135deg, #667eea, #764ba2);"><div class="num">${total}</div><div class="lbl">Total</div></div>
        <div class="stat-mini" style="background: linear-gradient(135deg, #00b894, #00cec9);"><div class="num">${presentes}</div><div class="lbl">✅ Presentes</div></div>
        <div class="stat-mini" style="background: linear-gradient(135deg, #fdcb6e, #e17055);"><div class="num">${tardanzas}</div><div class="lbl">⏰ Tardanzas</div></div>
        <div class="stat-mini" style="background: linear-gradient(135deg, #e74c3c, #fd79a8);"><div class="num">${ausentes}</div><div class="lbl">❌ Ausentes</div></div>
    `;
   progressFill.textContent = porcentaje + '%';
}
