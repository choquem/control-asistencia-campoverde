const CONFIG = {
    // ⚠️ REEMPLAZA CON TU URL ACTUAL DE GOOGLE APPS SCRIPT
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw1FCieIebxQRsYVToFFoxZlXmpJcA1ugyDCGdrmA6-KvPLtc2L5aqddjLAX2ojIuQmmQ/exec',
    CSV_URL: 'https://raw.githubusercontent.com/choquem/control-asistencia-campoverde/main/students.csv'
};

console.log(' utils.js cargado');
console.log('📡 URL de Google Script:', CONFIG.GOOGLE_SCRIPT_URL);

async function loadStudents() {
    console.log(' Cargando estudiantes desde CSV...');
    try {
        const response = await fetch(CONFIG.CSV_URL);
        const text = await response.text();
        console.log('✅ CSV descargado:', text.length, 'bytes');
        
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
            console.error('❌ CSV vacío');
            return { students: [], uniqueTeachers: [] };
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        console.log('📋 Encabezados:', headers);
        
        const idxNombre = headers.findIndex(h => h.includes('nombre'));
        const idxMaestro = headers.findIndex(h => h.includes('maestro'));
        
        console.log('🔍 Índice Nombre:', idxNombre, '| Índice Maestro:', idxMaestro);
        
        if (idxNombre === -1 || idxMaestro === -1) {
            console.error('❌ No encontró columnas');
            return { students: [], uniqueTeachers: [] };
        }
        
        const students = [];
        const teachers = new Set();
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const nombre = values[idxNombre];
            const maestro = values[idxMaestro];
            
            if (nombre && maestro) {
                students.push({ nombre, maestro });
                teachers.add(maestro);
            }
        }
        
        console.log('✅ Estudiantes cargados:', students.length);
        console.log('🏫 Maestros:', Array.from(teachers));
        
        return { students, uniqueTeachers: Array.from(teachers) };
    } catch (error) {
        console.error('❌ Error:', error);
        return { students: [], uniqueTeachers: [] };
    }
}

async function loadAttendanceFromSheet() {
    console.log(' Cargando asistencia desde Google Sheets...');
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL);
        const text = await response.text();
        console.log('📥 Status:', response.status);
        console.log('📄 Respuesta:', text.length, 'bytes');
        
        if (!text.trim().startsWith('{')) {
            console.error('❌ No es JSON');
            return [];
        }

        const result = JSON.parse(text);
        console.log('✅ JSON parseado');
        
        if (result.result === 'success') {
            console.log(' Registros en Sheets:', result.data.length);
            
            const records = result.data.map(function(record) {
                const nombre = record.nombre || record.alumno || record.Alumno || '';
                const fechaRaw = record.fecha || record.Fecha || '';
                const estado = record.estado || record.Estado || '';
                
                // Normalizar fecha
                const fecha = normalizeDate(fechaRaw);
                
                return {
                    id: record.id || record.ID || generarID(nombre, fecha),
                    fecha: fecha,
                    nombre: String(nombre).trim(),
                    estado: String(estado).trim().toLowerCase()
                };
            });
            
            // Log de fechas normalizadas
            console.log('🔍 Primeras 5 fechas normalizadas:');
            records.slice(0, 5).forEach((r, i) => {
                console.log(`  ${i+1}. ${r.nombre}: "${r.fecha}"`);
            });
            
            const deduped = deduplicateAttendance(records);
            console.log('✅ Asistencia procesada:', deduped.length, 'registros únicos');
            
            // Contar por fecha
            const fechasCount = {};
            deduped.forEach(r => {
                fechasCount[r.fecha] = (fechasCount[r.fecha] || 0) + 1;
            });
            console.log('📅 Registros por fecha:', fechasCount);
            
            return deduped;
        }
        return [];
    } catch (error) {
        console.error('❌ Error:', error);
        return [];
    }
}

// ✅ FUNCIÓN CORREGIDA - Maneja fechas ISO con hora
function normalizeDate(fecha) {
    if (!fecha) return '';
    
    // Si es objeto Date
    if (fecha instanceof Date) {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }
    
    const str = String(fecha).trim();
    
    // ✅ Si viene con hora (ISO: 2026-08-21T04:00:00.000Z)
    if (str.includes('T')) {
        return str.split('T')[0]; // Tomar solo YYYY-MM-DD
    }
    
    // Si ya está en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // Si tiene barra (DD/MM/YYYY)
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
    }
    
    // Intentar parsear como Date
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }
    
    return str;
}

function deduplicateAttendance(records) {
    const seen = new Map();
    records.forEach(r => {
        if (!r.nombre || !r.fecha) return;
        const key = r.nombre + '_' + r.fecha;
        if (!seen.has(key)) {
            seen.set(key, r);
        } else {
            const existing = seen.get(key);
            if (existing.estado === 'ausente' && r.estado !== 'ausente') {
                seen.set(key, r);
            }
        }
    });
    return Array.from(seen.values());
}

function generarID(nombre, fecha) {
    const nombreNorm = String(nombre)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    
    return nombreNorm + '_' + fecha;
}

function getWeekDays(offset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff + (offset * 7));
    
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        days.push({
            name: dayNames[date.getDay()],
            date: date.toISOString().split('T')[0],
            fullDate: date.getDate() + ' ' + monthNames[date.getMonth()]
        });
    }
    return days;
}

function getBestStatus(records) {
    if (!records || records.length === 0) return null;
    if (records.some(r => r.estado === 'presente')) return 'presente';
    if (records.some(r => r.estado === 'tardanza')) return 'tardanza';
    if (records.some(r => r.estado === 'ausente')) return 'ausente';
    return null;
}
