const CONFIG = {
    // ⚠️ PEGA AQUÍ LA URL DE TU NUEVA IMPLEMENTACIÓN
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw1FCieIebxQRsYVToFFoxZlXmpJcA1ugyDCGdrmA6-KvPLtc2L5aqddjLAX2ojIuQmmQ/exec',
    CSV_URL: 'https://raw.githubusercontent.com/choquem/control-asistencia-campoverde/main/students.csv'
};

console.log(' utils.js cargado');
console.log('📡 URL de Google Script:', CONFIG.GOOGLE_SCRIPT_URL);

async function loadStudents() {
    console.log('📚 Cargando estudiantes desde CSV...');
    try {
        const response = await fetch(CONFIG.CSV_URL);
        const text = await response.text();
        
        console.log('✅ CSV descargado:', text.length, 'bytes');
        console.log('📄 Contenido COMPLETO del CSV:');
        console.log(text);
        console.log('📄 Líneas separadas:');
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            console.log(`Línea ${i}: "${line}"`);
        });
        
        const filteredLines = lines.filter(l => l.trim());
        if (filteredLines.length < 2) {
            console.error('❌ CSV sin datos válidos');
            return { students: [], uniqueTeachers: [] };
        }
        
        const firstLine = filteredLines[0];
        console.log(' Primera línea (encabezados):', firstLine);
        
        const headers = firstLine.split(',').map(h => {
            const clean = h.trim().toLowerCase();
            console.log(`  Header: "${h}" → "${clean}"`);
            return clean;
        });
        
        const idxNombre = headers.findIndex(h => h.includes('nombre'));
        const idxMaestro = headers.findIndex(h => h.includes('maestro'));
        
        console.log('🔍 Índice Nombre:', idxNombre, '| Índice Maestro:', idxMaestro);
        
        if (idxNombre === -1 || idxMaestro === -1) {
            console.error('❌ No encontró columnas. Headers detectados:', headers);
            return { students: [], uniqueTeachers: [] };
        }
        
        const students = [];
        const teachers = new Set();
        
        for (let i = 1; i < filteredLines.length; i++) {
            const values = filteredLines[i].split(',').map(v => v.trim());
            const nombre = values[idxNombre];
            const maestro = values[idxMaestro];
            
            if (nombre && maestro) {
                students.push({ nombre, maestro });
                teachers.add(maestro);
            }
        }
        
        console.log('✅ Estudiantes cargados:', students.length);
        console.log('‍🏫 Maestros:', Array.from(teachers));
        
        return { students, uniqueTeachers: Array.from(teachers) };
    } catch (error) {
        console.error(' Error:', error);
        return { students: [], uniqueTeachers: [] };
    }
}
async function loadAttendanceFromSheet() {
    console.log(' Cargando asistencia desde Google Sheets...');
    try {
        console.log(' Fetching:', CONFIG.GOOGLE_SCRIPT_URL);
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL);
        console.log('📥 Status:', response.status);
        
        const text = await response.text();
        console.log('📄 Respuesta recibida:', text.length, 'bytes');
        console.log('📄 Primeros 100 chars:', text.substring(0, 100));
        
        // Verificar que sea JSON
        if (!text.trim().startsWith('{')) {
            console.error('❌ La respuesta NO es JSON. Es:', text.substring(0, 50));
            return [];
        }

        const result = JSON.parse(text);
        console.log('✅ JSON parseado:', result);
        
        if (result.result === 'success') {
            const dataLength = result.data ? result.data.length : 0;
            console.log('📋 Registros en Sheets:', dataLength);
            
            if (dataLength > 0) {
                console.log(' Primer registro:', result.data[0]);
            }
            
            const records = (result.data || []).map(function(record) {
                const nombre = record.nombre || record.alumno || record.Alumno || '';
                const fecha = record.fecha || record.Fecha || '';
                const estado = record.estado || record.Estado || '';
                
                return {
                    id: record.id || record.ID || generarID(nombre, normalizeDate(fecha)),
                    fecha: normalizeDate(fecha),
                    nombre: String(nombre).trim(),
                    estado: String(estado).trim().toLowerCase()
                };
            });
            
            const deduped = deduplicateAttendance(records);
            console.log('✅ Asistencia procesada:', deduped.length, 'registros únicos');
            return deduped;
        } else {
            console.error('❌ El script devoló error:', result);
            return [];
        }
    } catch (error) {
        console.error('❌ Error cargando asistencia:', error);
        console.error('Stack:', error.stack);
        return [];
    }
}

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
    
    // Si ya está en formato YYYY-MM-DD (sin hora)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // Si viene con hora (ISO: 2026-08-21T04:00:00.000Z)
    if (str.includes('T')) {
        return str.split('T')[0]; // Tomar solo la parte de la fecha
    }
    
    // Si tiene barra (DD/MM/YYYY o MM/DD/YYYY)
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
