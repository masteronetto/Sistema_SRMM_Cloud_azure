import test from 'node:test';
import assert from 'node:assert/strict';
import { toMaquinariaInput } from '../src/domains/maquinaria/maquinaria.dto.js';
import { validateMaquinaria } from '../src/domains/maquinaria/maquinaria.validation.js';

test('acepta una maquinaria valida con plan opcional', () => {
  const input = toMaquinariaInput({
    modelo_equipo: 'Excavadora CAT 320',
    horometro_actual: '120.5',
    estado: 'Disponible',
    tarifa_diaria: '100000'
  });

  assert.deepEqual(validateMaquinaria(input), {});
  assert.equal(input.plan_mantenimiento_id, null);
});

test('rechaza modelo vacio, horometro negativo y tarifa negativa', () => {
  const input = toMaquinariaInput({ modelo_equipo: ' ', horometro_actual: -1, tarifa_diaria: -10 });
  const errors = validateMaquinaria(input);

  assert.ok(errors.modelo_equipo);
  assert.ok(errors.horometro_actual);
  assert.ok(errors.tarifa_diaria);
});

test('rechaza estados y planes invalidos', () => {
  const input = toMaquinariaInput({ modelo_equipo: 'Equipo', estado: 'Desconocido', planes_mantencion_id_plan: '0' });
  const errors = validateMaquinaria(input);

  assert.ok(errors.estado);
  assert.ok(errors.plan_mantenimiento_id);
});