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
        console.log('Asistencia cargada:', attendanceData.length, 'registros');
    } catch (error) {
        document.getElementById('loadingStudents').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
        console.error('Error inicializando registro:', error);
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
        attendanceData.filter(function(r) { return r.fecha === fecha; }).forEach(function(r) { 
            tempAttendance[r.nombre] = r.estado; 
        });
    }

    const filtered = currentTeacherFilter === 'todos' ? students : students.filter(function(s) { return s.maestro === currentTeacherFilter; });
    
    let html = '<table><thead><tr><th style="width: 35%;">Alumno</th><th>Estado</th></tr></thead><tbody>';
    
    filtered.forEach(function(student, index) {
        const state = tempAttendance[student.nombre] || '';
        html += '<tr><td><strong>' + (index + 1) + '. ' + student.nombre + '</strong> <small style="color: #666;">(' + student.maestro + ')</small></td>';
        html += '<td><div class="status-buttons">';
        html += '<button class="status-btn presente ' + (state === 'presente' ? 'active' : '') + '" onclick="setStatus(\'' + student.nombre + '\', \'presente\')">✅ Presente</button>';
        html += '<button class="status-btn ausente ' + (state === 'ausente' ? 'active' : '') + '" onclick="setStatus(\'' + student.nombre + '\', \'ausente\')"> Ausente</button>';
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
    if (!fecha) { 
        alert('Selecciona una fecha'); 
        return; 
    }
    
    const validEntries = Object.keys(tempAttendance).filter(function(k) { return k !== '_loadedFor'; });
    if (validEntries.length === 0) { 
        alert('Marca al menos un alumno'); 
        return; 
    }

    isSaving = true;
    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = 'Analizando cambios...';

    let toInsert = [];
    let toUpdate = [];
    let unchanged = 0;

    validEntries.forEach(function(student) {
        const newStatus = tempAttendance[student];
        const id = generarID(student, fecha);
        
        const existing = attendanceData.find(function(r) { 
            return r.id === id; 
        });

        if (existing) {
            if (existing.estado !== newStatus) {
                toUpdate.push({
                    id: id,
                    nombre: student,
                    fecha: fecha,
                    estado: newStatus,
                    action: 'update',
                    anterior: existing.estado
                });
            } else {
                unchanged++;
            }
        } else {
            toInsert.push({
                id: id,
                nombre: student,
                fecha: fecha,
                estado: newStatus,
                action: 'insert'
            });
        }
    });

    const totalChanges = toInsert.length + toUpdate.length;

    console.log('========================================');
    console.log('📋 REPORTE - Fecha:', fecha);
    console.log('👥 Total:', validEntries.length);
    console.log('✅ Sin cambios:', unchanged);
    console.log(' Nuevos:', toInsert.length);
    console.log('🔄 Actualizar:', toUpdate.length);
    
    if (toUpdate.length > 0) {
        console.log('🔄 ACTUALIZACIONES:');
        toUpdate.forEach(function(r, i) {
            console.log((i+1) + '. ' + r.nombre + ' (ID: ' + r.id + ')');
            console.log('   ' + r.anterior + ' → ' + r.estado);
        });
    }
    
    if (toInsert.length > 0) {
        console.log(' NUEVOS:');
        toInsert.forEach(function(r) {
            console.log('• ' + r.nombre + ' (ID: ' + r.id + ')');
        });
    }
    console.log('========================================');

    let debugHtml = '<div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin: 10px 0; font-size: 0.8rem; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;">';
    debugHtml += '<strong>📋 Detalle:</strong><br>';
    debugHtml += '<small>Sin cambios: ' + unchanged + '</small><br><br>';
    
    if (toInsert.length > 0) {
        debugHtml += '<strong style="color: #00b894;">🆕 Nuevos (' + toInsert.length + '):</strong><br>';
        toInsert.forEach(function(r) {
            debugHtml += '• ' + r.nombre + ' → ' + r.estado + '<br>';
        });
        debugHtml += '<br>';
    }
    
    if (toUpdate.length > 0) {
        debugHtml += '<strong style="color: #fdcb6e;">🔄 Actualizados (' + toUpdate.length + '):</strong><br>';
        toUpdate.forEach(function(r) {
            debugHtml += '• ' + r.nombre + '<br>';
            debugHtml += '&nbsp;&nbsp;Antes: ' + r.anterior + ' → Ahora: ' + r.estado + '<br>';
        });
    }
    debugHtml += '</div>';

    if (totalChanges === 0) {
        document.getElementById('saveMessage').innerHTML = '<div class="success">ℹ️ No hay cambios</div>' + debugHtml;
        isSaving = false;
        btn.disabled = false;
        btn.textContent = '💾 Guardar en Google Sheets';
        return;
    }

    btn.textContent = 'Guardando ' + totalChanges + ' cambios...';
    const allChanges = toInsert.concat(toUpdate);

    try {
        for (let i = 0; i < allChanges.length; i++) {
            console.log(' Enviando #' + (i+1) + ':', allChanges[i]);
            
            await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allChanges[i])
            });
            await new Promise(function(r) { setTimeout(r, 300); });
        }
        
        let msg = '<div class="success">✅ ';
        if (toUpdate.length > 0) msg += toUpdate.length + ' actualizado' + (toUpdate.length > 1 ? 's' : '');
        if (toUpdate.length > 0 && toInsert.length > 0) msg += ', ';
        if (toInsert.length > 0) msg += toInsert.length + ' nuevo' + (toInsert.length > 1 ? 's' : '');
        msg += '</div>';
        
        document.getElementById('saveMessage').innerHTML = msg + debugHtml;
        
        setTimeout(function() {
            loadAttendanceFromSheet().then(function(data) {
                attendanceData = data;
                tempAttendance = { _loadedFor: null };
                renderAttendanceTable();
                document.getElementById('saveMessage').innerHTML = '';
            });
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('saveMessage').innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
    } finally {
        isSaving = false;
        btn.disabled = false;
        btn.textContent = '💾 Guardar en Google Sheets';
    }
}
