let students = [];
let attendanceData = [];
let selectedWeek = 0;
let summaryTeacherFilter = 'todos';
let attendanceColorFilter = 'todos';

if (!checkAuth()) {
} else {
    document.getElementById('navbar').innerHTML = generateNavigation('reporte');
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
        console.error('Error:', error);
    }
}

function generateTeacherFilters(teachers) {
    const container = document.getElementById('summaryTeacherFilters');
    teachers.forEach(function(teacher) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = teacher;
        btn.onclick = function() { filterSummaryByTeacher(teacher); };
        container.appendChild(btn);
    });
}

function filterSummaryByTeacher(teacher) {
    summaryTeacherFilter = teacher;
    document.querySelectorAll('#summaryTeacherFilters .filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (teacher === 'todos' && btn.textContent.includes('Todos')) btn.classList.add('active');
        else if (btn.textContent === teacher) btn.classList.add('active');
    });
    renderWeeklySummary();
}

function filterByAttendanceColor(color) {
    attendanceColorFilter = color;
    document.querySelectorAll('.color-filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.dataset.color === color) {
            btn.classList.add('active');
        }
    });
    renderWeeklySummary();
}

function renderWeekSelector() {
    const selector = document.getElementById('weekSelector');
    selector.innerHTML = '';
    for (let i = 0; i >= -3; i--) {
        const btn = document.createElement('button');
        btn.className = 'week-btn' + (i === selectedWeek ? ' active' : '');
        if (i === 0) btn.textContent = 'Esta Semana';
        else if (i === -1) btn.textContent = 'Semana Pasada';
        else btn.textContent = 'Semana ' + i;
        btn.onclick = function() {
            selectedWeek = i;
            document.querySelectorAll('.week-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            renderWeeklySummary();
        };
        selector.appendChild(btn);
    }
}

function renderWeeklySummary() {
    const days = getWeekDays(selectedWeek);
    document.getElementById('weekRange').textContent = days[0].fullDate + ' - ' + days[days.length - 1].fullDate;

    const filteredStudents = summaryTeacherFilter === 'todos' ? students : students.filter(function(s) { return s.maestro === summaryTeacherFilter; });

    let html = '<table class="summary-table"><thead><tr><th>Alumno</th>';
    days.forEach(function(day) {
        // ✅ Mostrar día + número (ej: Lun 17, Mar 18)
        const dayNumber = day.date.split('-')[2];
        html += '<th>' + day.name + ' ' + dayNumber + '</th>';
    });
    html += '<th>Total</th></tr></thead><tbody>';

    filteredStudents.forEach(function(student, index) {
        const registrosAlumno = attendanceData.filter(function(r) { return r.nombre === student.nombre; });
        const fechasUnicas = [...new Set(registrosAlumno.map(function(r) { return r.fecha; }))];
        
        let totalAsistencias = 0;
        let totalDias = fechasUnicas.length;
        
        fechasUnicas.forEach(function(fecha) {
            const registrosDelDia = registrosAlumno.filter(function(r) { return r.fecha === fecha; });
            const bestStatus = getBestStatus(registrosDelDia);
            if (bestStatus === 'presente' || bestStatus === 'tardanza') {
                totalAsistencias++;
            }
        });
        
        const porcentaje = totalDias > 0 ? Math.round((totalAsistencias / totalDias) * 100) : 0;
        
        let mostrarAlumno = true;
        if (attendanceColorFilter === 'verde' && porcentaje < 75) mostrarAlumno = false;
        if (attendanceColorFilter === 'amarillo' && (porcentaje < 50 || porcentaje >= 75)) mostrarAlumno = false;
        if (attendanceColorFilter === 'rojo' && porcentaje >= 50) mostrarAlumno = false;
        
        if (!mostrarAlumno) return;
        
        let bgColor = '#dc3545';
        let textColor = '#ffffff';
        
        if (porcentaje >= 75) {
            bgColor = '#28a745';
        } else if (porcentaje >= 50) {
            bgColor = '#ffc107';
            textColor = '#212529';
        }
        
        html += '<tr><td>' + (index + 1) + '. ' + student.nombre + '</td>';
        days.forEach(function(day) {
            const allRecords = attendanceData.filter(function(r) { return r.nombre === student.nombre && r.fecha === day.date; });
            const bestStatus = getBestStatus(allRecords);
            let cellContent = '-';
            if (bestStatus === 'presente') cellContent = '✅';
            else if (bestStatus === 'ausente') cellContent = '❌';
            else if (bestStatus === 'tardanza') cellContent = '';
            html += '<td>' + cellContent + '</td>';
        });
        html += '<td style="background-color:' + bgColor + ';color:' + textColor + ';text-align:center;font-weight:bold;padding:8px;">' + 
                    '<div style="font-size: 1.1rem;">' + porcentaje + '%</div>' +
                    '<div style="font-size: 0.8rem; opacity: 0.9; margin-top: 2px;">' + totalAsistencias + '/' + totalDias + '</div>' +
        '</td></tr>';
        //html += '<td style="background-color:' + bgColor + ';color:' + textColor + ';text-align:center;font-weight:bold;padding:8px;">' + porcentaje + '%</td></tr>';
    });
    
    html += '</tbody></table>';
    document.getElementById('weeklySummaryTable').innerHTML = html;
}
