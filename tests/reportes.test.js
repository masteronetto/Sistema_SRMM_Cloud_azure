const assert = require('assert');
const repo = require('../src/Entities/reportes/reportes.repository');

function almostEqual(a, b, eps = 0.0001) {
    return Math.abs(a - b) < eps;
}

// Tests for computePorcentajeVinculadas
(() => {
    console.log('Running reportes.repository tests...');

    assert.strictEqual(typeof repo.computePorcentajeVinculadas, 'function', 'computePorcentajeVinculadas should be exported');

    assert.strictEqual(repo.computePorcentajeVinculadas(0, 0), 0, '0/0 => 0');
    assert.strictEqual(repo.computePorcentajeVinculadas(0, 10), 0, '0/10 => 0');
    assert.strictEqual(repo.computePorcentajeVinculadas(5, 10), 50, '5/10 => 50');
    assert.strictEqual(repo.computePorcentajeVinculadas(3, 7), Number(((3 / 7) * 100).toFixed(2)), '3/7 => rounded percentage');

    console.log('All reportes.repository tests passed.');
})();
