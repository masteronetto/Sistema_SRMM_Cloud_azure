const allowedStates = new Set(['Disponible', 'Arrendada', 'Mantencion', 'Bloqueada', 'No Operativa']);

export function validateMaquinaria(input) {
  const errors = {};
  if (!input.modelo_equipo) errors.modelo_equipo = 'El modelo es obligatorio.';
  if (!Number.isFinite(input.horometro_actual) || input.horometro_actual < 0) errors.horometro_actual = 'El horometro debe ser un numero no negativo.';
  if (!allowedStates.has(input.estado)) errors.estado = 'El estado no es valido.';
  if (input.tarifa_diaria !== null && (!Number.isFinite(input.tarifa_diaria) || input.tarifa_diaria < 0)) errors.tarifa_diaria = 'La tarifa debe ser un numero no negativo.';
  if (input.plan_mantenimiento_id !== null && (!Number.isInteger(input.plan_mantenimiento_id) || input.plan_mantenimiento_id < 1)) errors.plan_mantenimiento_id = 'El plan debe ser un identificador valido.';
  return errors;
}

export { allowedStates };
