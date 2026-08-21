// ============================================
// FUNCIONES ESPECÍFICAS - PÁGINA DE REGISTRO
// ============================================

let students = [];
let attendanceData = [];
let tempAttendance = {};
let isSaving = false;
let currentTeacherFilter = 'todos';

// Verificar que sea admin al cargar
if (!isAdmin()) {
    window.location.href =

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('fecha').valueAsDate = new Date();
    updateCurrentDate();
    
    document.getElementById('fecha').addEventListener('change', function() {
        updateCurrentDate();
        renderAttendanceTable();
    });
    
    try {
        const data = await loadStudents();
        students = data.students;
        
        generateTeacherFilters('teacherFilters', filterByTeacher);
        
        document.getElementById('loadingStudents').style.display = 'none';
        document.getElementById('registrationPanel').style.display = 'block';
        updateStudentCount();
        renderAttendanceTable();
        
        // Cargar asistencia
        attendanceData = await loadAttendanceFromSheet();
        showSyncStatus('✅ Sincronizado', 'connected');
    } catch (error) {
        document.getElementById('loadingStudents').innerHTML = `
            <div class="error">❌ Error al cargar alumnos: ${error.message}</div>
        `;
    }
});

function updateCurrentDate() {
    const fechaInput = document.getElementById('fecha').value;
    const date = new Date(fechaInput + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = date.toLocaleDateString('es', options);
}

function filterByTeacher(teacher) {
    currentTeacherFilter = teacher;
    updateFilterButtons('teacherFilters', teacher);
    updateStudentCount();
    renderAttendanceTable();
}

function updateStudentCount() {
    const filteredStudents = currentTeacherFilter === 'todos' 
        ? students 
        : students.filter(s => s.maestro === currentTeacherFilter);
    document.getElementById('studentCount').textContent = `${filteredStudents.length} alumnos`;
}

function renderAttendanceTable() {
    const fecha = document.getElementById('fecha').value;
    
    if (Object.keys(tempAttendance).length === 0 || !tempAttendance._loadedFor || tempAttendance._loadedFor !== fecha) {
        tempAttendance = { _loadedFor: fecha };
        const existingRecords = attendanceData.filter(r => r.fecha === fecha);
        existingRecords.forEach(record => {
            tempAttendance[record.nombre] = record.estado;
        });
    }

    const filteredStudents = currentTeacherFilter === 'todos' 
        ? students 
        : students.filter(s => s.maestro === currentTeacherFilter);

    let html = `<table><thead><tr><th style="width: 35%;">Alumno</th><th>Estado</th></tr></thead><tbody>`;
    
    filteredStudents.forEach((student, index) => {
        const currentState = tempAttendance[student.nombre] || '';
        html += `<tr>
            <td><strong>${index + 1}. ${student.nombre}</strong> <small style="color: #666;">(${student.maestro})</small></td>
            <td>
                <div class="status-buttons">
                    <button class="status-btn presente ${currentState === 'presente' ? 'active' : ''}" onclick="setStatus('${student.nombre}', 'presente')">
                        <span class="icon">✅</span><span>Presente</span>
                    </button>
                    <button class="status-btn ausente ${currentState === 'ausente' ? 'active' : ''}" onclick="setStatus('${student.nombre}', 'ausente')">
                        <span class="icon">❌</span><span>Ausente</span>
                    </button>
                    <button class="status-btn tardanza ${currentState === 'tardanza' ? 'active' : ''}" onclick="setStatus('${student.nombre}', 'tardanza')">
                        <span class="icon">⏰</span><span>Tardanza</span>
                    </button>
                </div>
            </td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    document.getElementById('attendanceTable').innerHTML = html;
}

function setStatus(student, status) {
    tempAttendance[student] = status;
    const row = event.target.closest('tr');
    const buttons = row.querySelectorAll('.status-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.status-btn').classList.add('active');
}

async function saveAttendanceToSheet() {
    if (isSaving) {
        alert('⏳ Ya se está guardando...');
        return;
    }

    const fechaInput = document.getElementById('fecha').value;
    if (!fechaInput) {
        alert('⚠️ Selecciona una fecha');
        return;
    }
    
    const fecha = fechaInput;
    const validEntries = Object.keys(tempAttendance).filter(k => k !== '_loadedFor');
    if (validEntries.length === 0) {
        alert('Marca al menos un alumno');
        return;
    }

    isSaving = true;
    const btnSave = document.getElementById('btnSave');
    btnSave.disabled = true;
    btnSave.textContent = ' Guardando...';
    showSyncStatus('Guardando...', 'syncing');

    const newRecords = validEntries.map(student => ({ 
        nombre: student, 
        fecha: fecha, 
        estado: tempAttendance[student] 
    }));

    const success = await saveAttendanceToSheet(newRecords);
    
    if (success) {
        showSyncStatus('✅ Guardado', 'connected');
        document.getElementById('saveMessage').innerHTML = `<div class="success">✅ ${newRecords.length} registros guardados</div>`;
        setTimeout(() => { document.getElementById('saveMessage').innerHTML = ''; }, 3000);
        
        // Recargar datos
        setTimeout(async () => {
            attendanceData = await loadAttendanceFromSheet();
        }, 1000);
    } else {
        showSyncStatus('❌ Error', 'error');
    }

    isSaving = false;
    btnSave.disabled = false;
    btnSave.textContent = '💾 Guardar en Google Sheets';
}

function showSyncStatus(message, type) {
    const statusEl = document.getElementById('syncStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'sync-status ' + type;
        statusEl.style.display = 'inline-block';
    }
}