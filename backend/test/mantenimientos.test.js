import test from 'node:test';
import assert from 'node:assert/strict';
import mantenimientosRoutes from '../src/routes/mantenimientos.routes.js';

test('mantenimientos BFF exports rutas reales de tipos de servicio e historial', () => {
  const layers = mantenimientosRoutes.stack.filter((layer) => layer.route);
  const tiposServicio = layers.find((layer) => layer.route.path === '/tipos-servicio');
  const historial = layers.find((layer) => layer.route.path === '/maquina/:id/historial');

  assert.ok(tiposServicio, 'la ruta tipos-servicio debe existir');
  assert.ok(historial, 'la ruta historial debe existir');
  assert.notEqual(tiposServicio.route.stack[0].name, 'pending');
  assert.notEqual(historial.route.stack[0].name, 'pending');
});
