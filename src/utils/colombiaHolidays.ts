
/**
 * Utilidad para calcular los festivos de Colombia (Ley Emiliani)
 */

export interface Holiday {
    date: string; // ISO format YYYY-MM-DD
    name: string;
}

export const getColombiaHolidays = (year: number): Holiday[] => {
    const holidays: Holiday[] = [];

    const addHoliday = (month: number, day: number, name: string, emiliani: boolean = false) => {
        let date = new Date(year, month - 1, day);
        
        if (emiliani) {
            // Ley Emiliani: Si no es lunes, se traslada al siguiente lunes
            const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday...
            if (dayOfWeek !== 1) {
                const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
                date.setDate(date.getDate() + daysToAdd);
            }
        }
        
        holidays.push({
            date: date.toISOString().split('T')[0],
            name
        });
    };

    // --- Fijos (No se mueven) ---
    addHoliday(1, 1, 'Año Nuevo');
    addHoliday(5, 1, 'Día del Trabajo');
    addHoliday(7, 20, 'Día de la Independencia');
    addHoliday(8, 7, 'Batalla de Boyacá');
    addHoliday(12, 8, 'Día de la Inmaculada Concepción');
    addHoliday(12, 25, 'Navidad');

    // --- Fijos (Se mueven al lunes - Ley Emiliani) ---
    addHoliday(1, 6, 'Día de los Reyes Magos', true);
    addHoliday(3, 19, 'Día de San José', true);
    addHoliday(6, 29, 'San Pedro y San Pablo', true);
    addHoliday(8, 15, 'Asunción de la Virgen', true);
    addHoliday(10, 12, 'Día de la Raza', true);
    addHoliday(11, 1, 'Todos los Santos', true);
    addHoliday(11, 11, 'Independencia de Cartagena', true);

    // --- Basados en la Pascua ---
    const easter = getEaster(year);
    
    // Jueves y Viernes Santo
    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    holidays.push({ date: holyThursday.toISOString().split('T')[0], name: 'Jueves Santo' });

    const holyFriday = new Date(easter);
    holyFriday.setDate(easter.getDate() - 2);
    holidays.push({ date: holyFriday.toISOString().split('T')[0], name: 'Viernes Santo' });

    // Móviles basados en Pascua (Emiliani: siempre caen lunes)
    const addMovingHoliday = (daysAfterEaster: number, name: string) => {
        const date = new Date(easter);
        date.setDate(easter.getDate() + daysAfterEaster);
        // Estos ya están definidos para caer en lunes por tradición/ley en relación a la Pascua
        holidays.push({ date: date.toISOString().split('T')[0], name });
    };

    addMovingHoliday(43, 'Ascensión del Señor');
    addMovingHoliday(64, 'Corpus Christi');
    addMovingHoliday(71, 'Sagrado Corazón de Jesús');

    return holidays;
};

// Algoritmo de Butcher-Meeus para calcular el Domingo de Pascua
function getEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

export const isHoliday = (date: Date, holidays: Holiday[]): Holiday | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.find(h => h.date === dateStr);
};
