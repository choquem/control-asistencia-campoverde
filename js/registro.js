let students = [];
let attendanceData = [];
let tempAttendance = {};
let isSaving = false;
let currentTeacherFilter = 'todos';

if (!requireAdmin()) {
} else {
    document.getElementById('navbar').innerHTML = generateNavigation('registro');
    initRegistro();
}

async function initRegistro() {
    document.getElementById('fecha').valueAsDate = new Date();
    updateCurrentDate();
    
    document.getElementById('fecha').addEventListener('change', function() {
        updateCurrentDate();
        renderAttendanceTable();
    });
    
    try {
        const data = await loadStudents();
        students = data.students;
        generateTeacherFilters(data.uniqueTeachers);
        
        document.getElementById('loadingStudents').style.display = 'none';
        document.getElementById('registrationPanel').style.display = 'block';
        updateStudentCount();
        renderAttendanceTable();
        
        attendanceData = await loadAttendanceFromSheet();
    } catch (error) {
        document.getElementById('loadingStudents').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
    }
}

function updateCurrentDate() {
    const fechaInput = document.getElementById('fecha').value;
    const date = new Date(fechaInput + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = date.toLocaleDateString('es', options);
}

function generateTeacherFilters(teachers) {
    const container = document.getElementById('teacherFilters');
    teachers.forEach(function(teacher) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = teacher;
        btn.onclick = function() { filterByTeacher(teacher); };
        container.appendChild(btn);
    });
}

function filterByTeacher(teacher) {
    currentTeacherFilter = teacher;
    document.querySelectorAll('#teacherFilters .filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (teacher === 'todos' && btn.textContent.includes('Todos')) btn.classList.add('active');
        else if (btn.textContent === teacher) btn.classList.add('active');
    });
    updateStudentCount();
    renderAttendanceTable();
}

function updateStudentCount() {
    const filtered = currentTeacherFilter === 'todos' ? students : students.filter(function(s) { return s.maestro === currentTeacherFilter; });
    document.getElementById('studentCount').textContent = filtered.length + ' alumnos';
}

function renderAttendanceTable() {
    const fecha = document.getElementById('fecha').value;
    if (Object.keys(tempAttendance).length === 0 || !tempAttendance._loadedFor || tempAttendance._loadedFor !== fecha) {
        tempAttendance = { _loadedFor: fecha };
        attendanceData.filter(function(r) { return r.fecha === fecha; }).forEach(function(r) { tempAttendance[r.nombre] = r.estado; });
    }

    const filtered = currentTeacherFilter === 'todos' ? students : students.filter(function(s) { return s.maestro === currentTeacherFilter; });
    let html = '<table><thead><tr><th style="width: 35%;">Alumno</th><th>Estado</th></tr></thead><tbody>';
    
    filtered.forEach(function(student, index) {
        const state = tempAttendance[student.nombre] || '';
        html += '<tr><td><strong>' + (index + 1) + '. ' + student.nombre + '</strong> <small>(' + student.maestro + ')</small></td><td>';
        html += '<div class="status-buttons">';
        html += '<button class="status-btn presente ' + (state === 'presente' ? 'active' : '') + '" onclick="setStatus(\'' + student.nombre + '\', \'presente\')">✅ Presente</button>';
        html += '<button class="status-btn ausente ' + (state === 'ausente' ? 'active' : '') + '" onclick="setStatus(\'' + student.nombre + '\', \'ausente\')">❌ Ausente</button>';
        html += '<button class="status-btn tardanza ' + (state === 'tardanza' ? 'active' : '') + '" onclick="setStatus(\'' + student.nombre + '\', \'tardanza\')">⏰ Tardanza</button>';
        html += '</div></td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('attendanceTable').innerHTML = html;
}

function setStatus(student, status) {
    tempAttendance[student] = status;
    const row = event.target.closest('tr');
    row.querySelectorAll('.status-btn').forEach(function(btn) { btn.classList.remove('active'); });
    event.target.closest('.status-btn').classList.add('active');
}

async function saveAttendance() {
    if (isSaving) return;
    const fecha = document.getElementById('fecha').value;
    if (!fecha) { alert('Selecciona una fecha'); return; }
    
    const validEntries = Object.keys(tempAttendance).filter(function(k) { return k !== '_loadedFor'; });
    if (validEntries.length === 0) { alert('Marca al menos un alumno'); return; }

    isSaving = true;
    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    // Preparar registros con acción (insert o update)
    const records = validEntries.map(function(student) {
        // Verificar si ya existe
        const existing = attendanceData.find(function(r) { 
            return r.nombre === student && r.fecha === fecha; 
        });
        
        return {
            nombre: student,
            fecha: fecha,
            estado: tempAttendance[student],
            action: existing ? 'update' : 'insert'
        };
    });

    try {
        // Enviar todos los registros al servidor
        for (let i = 0; i < records.length; i++) {
            await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(records[i])
            });
            await new Promise(function(r) { setTimeout(r, 200); });
        }
        
        document.getElementById('saveMessage').innerHTML = '<div class="success">✅ ' + records.length + ' registros guardados/actualizados</div>';
        
        // Recargar datos después de 2 segundos
        setTimeout(function() {
            loadAttendanceFromSheet().then(function(data) {
                attendanceData = data;
                document.getElementById('saveMessage').innerHTML = '';
            });
        }, 2000);
        
    } catch (error) {
        document.getElementById('saveMessage').innerHTML = '<div class="error">Error al guardar</div>';
    } finally {
        isSaving = false;
        btn.disabled = false;
        btn.textContent = 'Guardar en Google Sheets';
    }
}
