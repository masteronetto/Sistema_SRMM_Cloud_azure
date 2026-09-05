const assert = require('assert');
const controller = require('../src/Entities/maquinaria/maquinaria.controller');
const maquinariaRepo = require('../src/Entities/maquinaria/maquinaria.repository');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function testUpdateRejectsLowerHorometro() {
  const originalGetById = maquinariaRepo.getMaquinariaById;
  const originalUpdate = maquinariaRepo.updateMaquinaria;

  maquinariaRepo.getMaquinariaById = async () => ({
    id_maquina: 1,
    modelo_equipo: 'Excavadora CAT 320L',
    horometro_actual: 1500,
    estado: 'Disponible',
    especificaciones: null,
    planes_mantencion_id_plan: null,
    tarifa_diaria: null
  });

  let updateInvoked = false;
  maquinariaRepo.updateMaquinaria = async () => {
    updateInvoked = true;
    return null;
  };

  const req = {
    params: { id_maquina: '1' },
    body: {
      modelo_equipo: 'Excavadora CAT 320L',
      horometro_actual: 1400,
      estado: 'Disponible'
    }
  };
  const res = createRes();
  let nextCalled = false;

  try {
    await controller.update(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(res.statusCode, 400, 'Debe devolver 400 si el horómetro disminuye');
    assert.strictEqual(
      res.body?.message,
      'El horometro_actual no puede ser menor al valor previamente registrado',
      'Debe informar mensaje de validación esperado'
    );
    assert.strictEqual(updateInvoked, false, 'No debe intentar persistir un horómetro decreciente');
    assert.strictEqual(nextCalled, false, 'No debe delegar al middleware de error en este caso');
  } finally {
    maquinariaRepo.getMaquinariaById = originalGetById;
    maquinariaRepo.updateMaquinaria = originalUpdate;
  }
}

(async () => {
  console.log('Running maquinaria horometro tests...');
  await testUpdateRejectsLowerHorometro();
  console.log('All maquinaria horometro tests passed.');
})();
