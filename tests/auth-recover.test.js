const assert = require('assert');

function loadControllerWithStubs({ verifyImpl, sendMailImpl } = {}) {
  const nodemailerPath = require.resolve('nodemailer');
  const usuariosRepoPath = require.resolve('../src/Entities/usuarios/usuarios.repository');
  const authRepoPath = require.resolve('../src/Entities/auth/auth.repository');
  const controllerPath = require.resolve('../src/Entities/auth/auth.controller');

  const fakeTransport = {
    verify: async () => {
      if (verifyImpl) {
        return verifyImpl();
      }
      throw new Error('SMTP authentication failed');
    },
    sendMail: async (mailOptions) => {
      if (sendMailImpl) {
        return sendMailImpl(mailOptions);
      }
      return {};
    }
  };

  const fakeUsuariosRepo = {
    getUsuarioByEmail: async () => ({ id_usuario: 7, email: 'usuario@test.cl' }),
    updateUsuarioPassword: async () => ({}),
    insertUsuarioAuditLog: async () => ({})
  };

  const fakeAuthRepo = {
    createRecoveryAttempt: async () => ({})
  };

  require.cache[nodemailerPath] = {
    id: nodemailerPath,
    filename: nodemailerPath,
    loaded: true,
    exports: {
      createTransport: () => fakeTransport
    }
  };

  require.cache[usuariosRepoPath] = {
    id: usuariosRepoPath,
    filename: usuariosRepoPath,
    loaded: true,
    exports: fakeUsuariosRepo
  };

  require.cache[authRepoPath] = {
    id: authRepoPath,
    filename: authRepoPath,
    loaded: true,
    exports: fakeAuthRepo
  };

  delete require.cache[controllerPath];

  return require('../src/Entities/auth/auth.controller');
}

function createResponse() {
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

function createRequest() {
  return {
    body: { email: 'usuario@test.cl' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1'
  };
}

(async () => {
  console.log('Running auth recover tests...');

  try {
    const controller = loadControllerWithStubs({
      verifyImpl: async () => {},
      sendMailImpl: async (mailOptions) => {
        assert.match(mailOptions.html, /https:\/\/example\.com\/reset\?token=/, 'reset link should use the public reset route');
        return {};
      }
    });

    const res = createResponse();
    const req = createRequest();

    process.env.FRONTEND_URL = 'https://example.com';
    await controller.recover(req, res, () => {});
    assert.strictEqual(res.statusCode, 200, 'recover should succeed when SMTP works');

    const controllerWithFailure = loadControllerWithStubs();
    const failedRes = createResponse();
    await controllerWithFailure.recover(createRequest(), failedRes, () => {});

    assert.strictEqual(failedRes.statusCode, 502, 'recover should return 502 when SMTP fails');
    assert.match(String(failedRes.body?.message || ''), /No fue posible enviar/i, 'error should be explicit');

    console.log('All auth recover tests passed.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
