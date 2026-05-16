export const fieldTranslations = {
  en: {
    yourShift: 'Your Shift',
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    start: 'START',
    done: 'DONE',
    completed: 'Completed',
    noTasks: 'No tasks assigned for today',
    notScheduled: "You're not scheduled today",
    tasksDone: 'tasks done',
    reportNeed: 'Report a Need',
    howLong: 'How long did this take?',
    shiftComplete: 'Shift complete',
  },
  es: {
    yourShift: 'Tu Turno',
    clockIn: 'Entrada',
    clockOut: 'Salida',
    start: 'INICIAR',
    done: 'LISTO',
    completed: 'Completado',
    noTasks: 'No hay tareas asignadas para hoy',
    notScheduled: 'No estás programado hoy',
    tasksDone: 'tareas completadas',
    reportNeed: 'Reportar Necesidad',
    howLong: '¿Cuánto tiempo tomó?',
    shiftComplete: 'Turno completado',
  },
} as const;

export type FieldLanguage = keyof typeof fieldTranslations;
