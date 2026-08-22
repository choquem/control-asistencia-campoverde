// ============================================
// FUNCIONES COMPARTIDAS
// ============================================

const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx0IQJhUZAGdKV0-BMWihpwnYMTlwrPOn4Y3C3uJ4XXfuvU1tbqR10q5jS-svnSvk3QzA/exec',
    CSV_URL: 'https://raw.githubusercontent.com/choquem/control-asistencia-campoverde/main/students.csv'
};

function getLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeDate(dateValue) {
    if (!dateValue) return '';
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return dateValue.trim();
    if (dateValue instanceof Date) return getLocalDate(dateValue);
    if (typeof dateValue === 'number') {
        const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
        return getLocalDate(date);
    }
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) return getLocalDate(date);
    }
    return String(dateValue);
}

function getBestStatus(records) {
    if (!records || records.length === 0) return null;
    if (records.some(r => r.estado === 'presente')) return 'presente';
    if (records.some(r => r.estado === 'tardanza')) return 'tardanza';
    if (records.some(r => r.estado === 'ausente')) return 'ausente';
    return records[0].estado;
}

function deduplicateAttendance(data) {
    const grouped = {};
    data.forEach(record => {
        const key = `${record.nombre}|${record.fecha}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(record);
    });
    return Object.keys(grouped).map(key => {
        const records = grouped[key];
        return { nombre: records[0].nombre, fecha: records[0].fecha, estado: getBestStatus(records) };
    });
}

async function loadStudents() {
    try {
        const response = await fetch(CONFIG.CSV_URL);
        if (!response.ok) throw new Error('Error al cargar CSV');
        const text = await response.text();
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const students = [];
        const teachersSet = new Set();
        
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const maestroIndex = headers.findIndex(h => h.includes('maestro') || h.includes('curso'));
        
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            if (columns.length >= 2) {
                const nombre = columns[1].trim();
                const maestro = maestroIndex >= 0 && columns[maestroIndex] ? columns[maestroIndex].trim() : 'General';
                if (nombre) {
                    students.push({ nombre, maestro });
                    teachersSet.add(maestro);
                }
            }
        }
        
        return { students, uniqueTeachers: Array.from(teachersSet).sort() };
    } catch (error) {
        console.error('Error cargando estudiantes:', error);
        throw error;
    }
}

async function loadAttendanceFromSheet() {
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL);
        const text = await response.text();
        const result = JSON.parse(text);
        
        if (result.result === 'success') {
            return deduplicateAttendance(
                (result.data || []).map(record => ({
                    fecha: normalizeDate(record.fecha),
                    nombre: String(record.nombre).trim(),
                    estado: String(record.estado).trim().toLowerCase()
                }))
            );
        }
        return [];
    } catch (error) {
        console.error('Error cargando asistencia:', error);
        return [];
    }
}

function getWeekDays(weekOffset = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const diff = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff + (weekOffset * 7));
    
    const days = [];
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    
    for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push({
            date: getLocalDate(day),
            name: dayNames[i],
            fullDate: day.toLocaleDateString('es', { day: '2-digit', month: 'short' })
        });
    }
    return days;
}
