const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxcf-60o3okEG1xwHUWouHAzD2aqH8iW84vmP0iLQPKsfZIyB-gohGoszUf5UJlQ55_2w/exec',
    CSV_URL: 'https://raw.githubusercontent.com/choquem/control-asistencia-campoverde/main/students.csv'
};

async function loadStudents() {
    try {
        const response = await fetch(CONFIG.CSV_URL);
        const text = await response.text();
        
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
            return { students: [], uniqueTeachers: [] };
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const idxNombre = headers.findIndex(h => h.includes('nombre'));
        const idxMaestro = headers.findIndex(h => h.includes('maestro'));
        
        if (idxNombre === -1 || idxMaestro === -1) {
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
        
        return { students, uniqueTeachers: Array.from(teachers) };
    } catch (error) {
        console.error('Error cargando estudiantes:', error);
        return { students: [], uniqueTeachers: [] };
    }
}

async function loadAttendanceFromSheet() {
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL);
        const text = await response.text();
        
        if (!text.trim().startsWith('{')) {
            return [];
        }

        const result = JSON.parse(text);
        
        if (result.result === 'success') {
            const records = result.data.map(function(record) {
                const nombre = record.nombre || record.alumno || record.Alumno || '';
                const fechaRaw = record.fecha || record.Fecha || '';
                const estado = record.estado || record.Estado || '';
                
                const fecha = normalizeDate(fechaRaw);
                
                return {
                    id: record.id || record.ID || generarID(nombre, fecha),
                    fecha: fecha,
                    nombre: String(nombre).trim(),
                    estado: String(estado).trim().toLowerCase()
                };
            });
            
            return deduplicateAttendance(records);
        }
        return [];
    } catch (error) {
        console.error('Error cargando asistencia:', error);
        return [];
    }
}

function normalizeDate(fecha) {
    if (!fecha) return '';
    
    if (fecha instanceof Date) {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }
    
    const str = String(fecha).trim();
    
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
    }
    
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
    
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToSubtract + (offset * 7));
    monday.setHours(12, 0, 0, 0);
    
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = year + '-' + month + '-' + day;
        
        days.push({
            name: dayNames[date.getDay()],
            date: dateStr,
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
