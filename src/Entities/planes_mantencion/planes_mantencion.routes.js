const {
  crearPlan,
  obtenerTodosLosPlanes,
  obtenerPlanPorId,
  actualizarPlan,
  eliminarPlan,
  asignarPlanAMaquina,
  desasignarPlanDeMaquina,
  obtenerPlanDeMaquina,
} = require('./planes_mantencion.controller');

const router = require('express').Router();

// CRUD de Planes
router.post('/', crearPlan);
router.get('/', obtenerTodosLosPlanes);
// Obtener plan de una máquina
router.get('/maquina/:maquina_id', obtenerPlanDeMaquina);

router.get('/:id', obtenerPlanPorId);
router.put('/:id', actualizarPlan);
router.delete('/:id', eliminarPlan);

// Asignación de planes a máquinas
router.post('/:id/asignar-maquina/:maquina_id', asignarPlanAMaquina);
router.delete('/:id/desasignar-maquina/:maquina_id', desasignarPlanDeMaquina);

module.exports = router;
