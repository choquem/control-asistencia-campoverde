let students = [];
let attendanceData = [];
let selectedWeek = 0;
let summaryTeacherFilter = 'todos';
let attendanceColorFilter = 'todos';
let attendanceCache = null; // Cache para datos precalculados

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
        
        // Precalcular datos una sola vez
        precalculateAttendance();
        
        renderWeekSelector();
        renderWeeklySummary();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ✅ FUNCIÓN NUEVA: Precalcular asistencia por estudiante
function precalculateAttendance() {
    attendanceCache = {};
    
    attendanceData.forEach(function(record) {
        const nombre = record.nombre;
        const fecha = record.fecha;
        const estado = record.estado;
        
        if (!attendanceCache[nombre]) {
            attendanceCache[nombre] = {
                porFecha: {},
                totalDias: new Set(),
                totalAsistencias: 0
            };
        }
        
        // Guardar mejor estado por fecha
        if (!attendanceCache[nombre].porFecha[fecha]) {
            attendanceCache[nombre].porFecha[fecha] = estado;
            attendanceCache[nombre].totalDias.add(fecha);
            
            if (estado === 'presente' || estado === 'tardanza') {
                attendanceCache[nombre].totalAsistencias++;
            }
        } else {
            // Actualizar si es mejor estado
            const existing = attendanceCache[nombre].porFecha[fecha];
            if (estado === 'presente' || (estado === 'tardanza' && existing !== 'presente')) {
                if (existing === 'ausente') {
                    attendanceCache[nombre].totalAsistencias++;
                }
                attendanceCache[nombre].porFecha[fecha] = estado;
            }
        }
    });
    
    console.log('✅ Datos precalculados:', Object.keys(attendanceCache).length, 'estudiantes');
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
        const dayNumber = day.date.split('-')[2];
        html += '<th>' + day.name + ' ' + dayNumber + '</th>';
    });
    html += '<th>Total</th></tr></thead><tbody>';

    filteredStudents.forEach(function(student, index) {
        // ✅ Usar datos precalculados del cache
        const cache = attendanceCache[student.nombre] || { totalDias: new Set(), totalAsistencias: 0, porFecha: {} };
        const totalDias = cache.totalDias.size;
        const totalAsistencias = cache.totalAsistencias;
        const porcentaje = totalDias > 0 ? Math.round((totalAsistencias / totalDias) * 100) : 0;
        
        // Aplicar filtro por color
        let mostrarAlumno = true;
        if (attendanceColorFilter === 'verde' && porcentaje < 75) mostrarAlumno = false;
        if (attendanceColorFilter === 'amarillo' && (porcentaje < 50 || porcentaje >= 75)) mostrarAlumno = false;
        if (attendanceColorFilter === 'rojo' && porcentaje >= 50) mostrarAlumno = false;
        
        if (!mostrarAlumno) return;
        
        // Colores
        let bgColor = '#dc3545';
        let textColor = '#ffffff';
        
        if (porcentaje >= 75) {
            bgColor = '#28a745';
        } else if (porcentaje >= 50) {
            bgColor = '#ffc107';
            textColor = '#212529';
        }
        
        // Renderizar filas
        html += '<tr><td>' + (index + 1) + '. ' + student.nombre + '</td>';
        days.forEach(function(day) {
            const bestStatus = cache.porFecha[day.date] || null;
            let cellContent = '-';
            if (bestStatus === 'presente') cellContent = '✅';
            else if (bestStatus === 'ausente') cellContent = '❌';
            else if (bestStatus === 'tardanza') cellContent = '⏰';
            html += '<td>' + cellContent + '</td>';
        });
        
        // Porcentaje con conteo
        html += '<td style="background-color:' + bgColor + ';color:' + textColor + ';text-align:center;font-weight:bold;padding:8px;">' + 
            '<div style="font-size: 1.1rem;">' + porcentaje + '%</div>' +
            '<div style="font-size: 0.8rem; opacity: 0.9; margin-top: 2px;">' + totalAsistencias + '/' + totalDias + '</div>' +
        '</td></tr>';
    });
    
    html += '</tbody></table>';
    document.getElementById('weeklySummaryTable').innerHTML = html;
    
    // Estadísticas rápidas
    updateStats(days);
}

function updateStats(days) {
    const weekDates = days.map(d => d.date);
    const filteredStudents = summaryTeacherFilter === 'todos' ? students : students.filter(function(s) { return s.maestro === summaryTeacherFilter; });
    const studentNames = new Set(filteredStudents.map(s => s.nombre));
    
    let total = 0, presentes = 0, ausentes = 0, tardanzas = 0;
    
    attendanceData.forEach(function(r) {
        if (weekDates.includes(r.fecha) && studentNames.has(r.nombre)) {
            total++;
            if (r.estado === 'presente') presentes++;
            else if (r.estado === 'ausente') ausentes++;
            else if (r.estado === 'tardanza') tardanzas++;
        }
    });
    
    const porcentajeGeneral = total > 0 ? Math.round(((presentes + tardanzas) / total) * 100) : 0;

    document.getElementById('statsRow').innerHTML = 
        '<div class="stat-mini" style="background: linear-gradient(135deg, #667eea, #764ba2);"><div class="num">' + total + '</div><div class="lbl">Total</div></div>' +
        '<div class="stat-mini" style="background: linear-gradient(135deg, #00b894, #00cec9);"><div class="num">' + presentes + '</div><div class="lbl">✅ Presentes</div></div>' +
        '<div class="stat-mini" style="background: linear-gradient(135deg, #fdcb6e, #e17055);"><div class="num">' + tardanzas + '</div><div class="lbl"> Tardanzas</div></div>' +
        '<div class="stat-mini" style="background: linear-gradient(135deg, #e74c3c, #fd79a8);"><div class="num">' + ausentes + '</div><div class="lbl">❌ Ausentes</div></div>';

    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = porcentajeGeneral + '%';
    progressFill.textContent = porcentajeGeneral + '%';
}
