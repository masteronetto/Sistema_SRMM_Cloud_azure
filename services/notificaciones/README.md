# Consumidor Node.js obsoleto

Este directorio contiene la implementación histórica del consumidor de
notificaciones en Node.js. Está obsoleta y se conserva únicamente como
referencia; no debe iniciarse ni desplegarse.

El consumidor activo es el microservicio Spring Boot ubicado en
`../notificaciones-spring`. Ejecutar ambas implementaciones en paralelo haría
que compitieran por las mismas colas.

La configuración de publicación en `backend/src/messaging/rabbit.config.js`
no está obsoleta: el BFF Express continúa publicando eventos con esos nombres
y Spring Boot consume el mismo contrato RabbitMQ.
