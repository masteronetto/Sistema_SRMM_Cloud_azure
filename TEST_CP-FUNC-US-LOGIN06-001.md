## CP-FUNC-US-LOGIN06-001: User Deactivation + JWT Token Invalidation
### Test Plan & Validation

#### Caso de Prueba 1: Desactivación de usuario con sesión activa
**Pasos:**
1. Usuario A inicia sesión en dashboard (obtiene token JWT válido)
2. Usuario B (Admin) entra a sección "Usuarios"
3. Localiza Usuario A en la tabla
4. Hace click en botón "Desactivar"
5. Confirma acción en modal

**Resultado Esperado:**
- ✅ Usuario A recibe 401 en próxima API call (sin necesidad de click adicional)
- ✅ Dashboard detecta 401 en validateCurrentSessionActive() (cada 5 min máximo)
- ✅ Usuario A es redirigido a login.html automáticamente
- ✅ Token es borrado de sessionStorage/localStorage
- ✅ Modal de alerta: "Tu cuenta ha sido desactivada"

#### Caso de Prueba 2: Page refresh mientras está desactivado
**Pasos:**
1. Usuario tiene sesión activa (válida)
2. Admin lo desactiva
3. Usuario recarga página (F5)
4. initDashboard() llama validateCurrentSessionActive()

**Resultado Esperado:**
- ✅ validateCurrentSessionActive() obtiene userData
- ✅ userData.activo === false
- ✅ Automáticamente redirige a login.html
- ✅ Token borrado
- ✅ Sin error en consola

#### Caso de Prueba 3: API call directo a endpoint protegido
**Pasos:**
1. Usuario desactivado hace fetch a /api/reportes con token JWT antiguo
2. Middleware verifyToken valida token (OK)
3. Middleware requireActiveUser consulta BD

**Resultado Esperado:**
- ✅ Query: SELECT activo FROM usuarios WHERE id = X
- ✅ Retorna activo=false
- ✅ Respuesta 401: {"message": "Tu cuenta ha sido desactivada...", "deactivated": true}

#### Caso de Prueba 4: Reactivación de usuario
**Pasos:**
1. Admin localiza usuario inactivo en tabla
2. Botón dice "Reactivar" (en color verde/success)
3. Hace click → Confirma
4. PUT /api/usuarios/:id/activate

**Resultado Esperado:**
- ✅ Usuario ahora aparece como "Activo" en tabla
- ✅ Usuario puede volver a login
- ✅ Nuevo JWT funciona normalmente

#### Caso de Prueba 5: Admin NO puede desactivarse a sí mismo
**Pasos:**
1. Admin entra a "Usuarios"
2. Intenta hacer click en "Desactivar" en su propia fila
3. Modal aparece

**Resultado Esperado:**
- ⚠️ Error 400: "No puedes desactivar tu propia cuenta"
- ✅ Botón no hace daño

#### Caso de Prueba 6: Validación de sesión periódica
**Pasos:**
1. Usuario A inicia sesión
2. Espera 5 minutos sin hacer nada
3. Admin desactiva Usuario A (durante la espera)
4. Usuario A sigue en dashboard esperando
5. Espera más 1 minuto (total 6+ minutos)

**Resultado Esperado:**
- ✅ setInterval(validateCurrentSessionActive, 300000) se ejecuta
- ✅ Detecta que fue desactivado
- ✅ Logout automático sin interacción

### Verificaciones Técnicas

**Backend Files:**
- ✅ /sql/007_usuario_activo.sql - Migración lista
- ✅ /src/middleware/auth.js - requireActiveUser() + verifyUserActive() 
- ✅ /src/Entities/usuarios/usuarios.repository.js - deactivateUsuario(), activateUsuario()
- ✅ /src/Entities/usuarios/usuarios.controller.js - deactivate(), activate()
- ✅ /src/Entities/usuarios/usuarios.routes.js - PUT /:id/deactivate, /:id/activate
- ✅ Rutas adicionales con requireActiveUser integrado

**Frontend Files:**
- ✅ /public/dashboard.html:
  - renderUsersList() - Nueva columna "Estado" + botones Desactivar/Reactivar
  - toggleUserActive() - Función para desactivación/reactivación
  - validateCurrentSessionActive() - Validación en initDashboard y periódica (5 min)
- ✅ /public/css/styles.css - status-badge.active/inactive, btn-warning, btn-success

**No Hay Errores:**
- ✅ get_errors en todos los archivos modificados = 0 errores

### Decisiones de Diseño

**1. ¿Por qué no usar Token Blacklist?**
- Requeriría Redis o BD adicional
- Consultar BD en cada request es más simple sin overhead de caché

**2. ¿Por qué validación periódica cada 5 minutos?**
- Balance entre seguridad y performance
- Máximo: usuario tiene 5 min extra de acceso tras desactivación
- Para revocación inmediata: API calls validan en tiempo real

**3. ¿Por qué no usar soft-delete con deleted_at?**
- activo BOOLEAN es más explícito y simple
- Permite reactivación sin migración adicional
- Retrocompatible (NULL/undefined → true)

**4. ¿Por qué requireActiveUser en algunas rutas no todas?**
- Login/Registro no necesitan validar estado
- Las más críticas (usuarios, reportes, incidencias) la tienen
- Extendible a más rutas si es necesario
