// ============================================
// FUNCIONES - PÁGINA DE REGISTRO
// ============================================

let students = [];
let attendanceData = [];
let tempAttendance = {};
let isSaving = false;
let currentTeacherFilter = 'todos';

// ============================================
// INICIALIZACIÓN
// ============================================

// Verificar autenticación al cargar
if (!requireAdmin()) {
    // Si no es admin, ya fue redirigido por requireAdmin()
} else {
    // Generar navegación
    document.getElementById('navbar').innerHTML = generateNavigation('registro');
    
    // Inicializar página
    initRegistro();
}

async function initRegistro() {
    // Establecer fecha de hoy
    document.getElementById('fecha').valueAsDate = new Date();
    updateCurrentDate();
    
    // Evento para cambiar fecha
    document.getElementById('fecha').addEventListener('change', function() {
        updateCurrentDate();
        renderAttendanceTable();
    });
    
    try {
        // Cargar lista de alumnos
        const data = await loadStudents();
        students = data.students;
        
        // Generar filtros de maestros
        generateTeacherFilters(data.uniqueTeachers);
        
        // Ocultar loading y mostrar panel
        document.getElementById('loadingStudents').style.display = 'none';
        document.getElementById('registrationPanel').style.display = 'block';
        updateStudentCount();
        renderAttendanceTable();
        
        // Cargar datos de asistencia desde Google Sheets
        attendanceData = await loadAttendanceFromSheet();
        console.log('Asistencia cargada:', attendanceData.length, 'registros');
    } catch (error) {
        document.getElementById('loadingStudents').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
        console.error('Error inicializando registro:', error);
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

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

// ============================================
// RENDERIZADO DE TABLA
// ============================================

function renderAttendanceTable() {
    const fecha = document.getElementById('fecha').value;
    
    // Cargar estado actual desde attendanceData si no hay cambios temporales para esta fecha
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

// ============================================
// GUARDADO OPTIMIZADO CON LOGS DE DEPURACIÓN
// ============================================

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

    // ============================================
    // COMPARAR CON DATOS EXISTENTES
    // ============================================
    let toInsert = [];
    let toUpdate = [];
    let unchanged = 0;

    validEntries.forEach(function(student) {
        const newStatus = tempAttendance[student];
        
        // Buscar si ya existe un registro para este alumno en esta fecha
        const existing = attendanceData.find(function(r) { 
            return r.nombre === student && r.fecha === fecha; 
        });

        if (existing) {
            // Si existe, verificar si cambió el estado
            if (existing.estado !== newStatus) {
                toUpdate.push({
                    nombre: student,
                    fecha: fecha,
                    estado: newStatus,
                    action: 'update',
                    anterior: existing.estado  // Para ver qué cambió
                });
            } else {
                unchanged++;
            }
        } else {
            // Si no existe, es nuevo
            toInsert.push({
                nombre: student,
                fecha: fecha,
                estado: newStatus,
                action: 'insert'
            });
        }
    });

    const totalChanges = toInsert.length + toUpdate.length;

    // ============================================
    // LOGS DE DEPURACIÓN (ver en consola F12)
    // ============================================
    console.log('========================================');
    console.log('📋 REPORTE DE GUARDADO - Fecha:', fecha);
    console.log('========================================');
    console.log('👥 Total alumnos marcados:', validEntries.length);
    console.log('✅ Sin cambios (no se envían):', unchanged);
    console.log('🆕 Nuevos a insertar:', toInsert.length);
    console.log('🔄 A actualizar:', toUpdate.length);
    console.log('----------------------------------------');
    
    if (toInsert.length > 0) {
        console.log('🆕 NUEVOS REGISTROS:');
        console.table(toInsert);
    }
    
    if (toUpdate.length > 0) {
        console.log(' ACTUALIZACIONES:');
        console.table(toUpdate);
    }
    console.log('========================================');

    // ============================================
    // MOSTRAR DETALLE EN PANTALLA (temporal)
    // ============================================
    let debugHtml = '<div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin: 10px 0; font-size: 0.85rem; max-height: 200px; overflow-y: auto; border: 1px solid #ddd;">';
    debugHtml += '<strong>📋 Detalle de envíos:</strong><br>';
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
            debugHtml += '• ' + r.nombre + ': ' + r.anterior + ' → ' + r.estado + '<br>';
        });
    }
    debugHtml += '</div>';

    // Si no hay cambios, mostrar mensaje y salir
    if (totalChanges === 0) {
        document.getElementById('saveMessage').innerHTML = '<div class="success">ℹ️ No hay cambios para guardar</div>' + debugHtml;
        isSaving = false;
        btn.disabled = false;
        btn.textContent = '💾 Guardar en Google Sheets';
        return;
    }

    btn.textContent = 'Guardando ' + totalChanges + ' cambios...';

    // Combinar todos los cambios
    const allChanges = toInsert.concat(toUpdate);

    try {
        // Enviar solo los cambios al servidor
        for (let i = 0; i < allChanges.length; i++) {
            console.log(' Enviando #' + (i+1) + ':', allChanges[i]);
            
            await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allChanges[i])
            });
            await new Promise(function(r) { setTimeout(r, 200); });
        }
        
        // Mensaje detallado
        let msg = '<div class="success">✅ ';
        if (toUpdate.length > 0) msg += toUpdate.length + ' actualizado' + (toUpdate.length > 1 ? 's' : '');
        if (toUpdate.length > 0 && toInsert.length > 0) msg += ', ';
        if (toInsert.length > 0) msg += toInsert.length + ' nuevo' + (toInsert.length > 1 ? 's' : '');
        msg += '</div>';
        
        document.getElementById('saveMessage').innerHTML = msg + debugHtml;
        
        // Recargar datos después de 3 segundos
        setTimeout(function() {
            loadAttendanceFromSheet().then(function(data) {
                attendanceData = data;
                tempAttendance = { _loadedFor: null };
                renderAttendanceTable();
                document.getElementById('saveMessage').innerHTML = '';
            });
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        document.getElementById('saveMessage').innerHTML = '<div class="error">❌ Error al guardar: ' + error.message + '</div>';
    } finally {
        isSaving = false;
        btn.disabled = false;
        btn.textContent = ' Guardar en Google Sheets';
    }
}
