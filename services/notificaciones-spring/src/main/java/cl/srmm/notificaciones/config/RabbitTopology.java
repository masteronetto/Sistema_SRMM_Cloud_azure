package cl.srmm.notificaciones.config;

public final class RabbitTopology {

    public static final String RENTAL_EXCHANGE = "srmm.arriendos";
    public static final String RENTAL_QUEUE = "srmm.notificaciones.arriendo-creado";
    public static final String RENTAL_ROUTING_KEY = "arriendo.creado";
    public static final String RENTAL_DLX = "srmm.arriendos.dlx";
    public static final String RENTAL_DLQ = "srmm.notificaciones.arriendo-creado.dlq";
    public static final String RENTAL_DEAD_ROUTING_KEY = "arriendo.creado.dead";

    public static final String LOGISTICS_EXCHANGE = "srmm.logistica";
    public static final String LOGISTICS_QUEUE = "srmm.notificaciones.logistica-estado";
    public static final String LOGISTICS_ROUTING_KEY = "logistica.estado-cambiado";
    public static final String LOGISTICS_DLX = "srmm.logistica.dlx";
    public static final String LOGISTICS_DLQ = "srmm.notificaciones.logistica-estado.dlq";
    public static final String LOGISTICS_DEAD_ROUTING_KEY = "logistica.estado-cambiado.dead";

    public static final String MAINTENANCE_EXCHANGE = "srmm.mantenimientos";
    public static final String MAINTENANCE_QUEUE = "srmm.tickets.incidencia-critica";
    public static final String MAINTENANCE_ROUTING_KEY = "mantenimiento.incidencia-critica";
    public static final String MAINTENANCE_DLX = "srmm.mantenimientos.dlx";
    public static final String MAINTENANCE_DLQ = "srmm.tickets.incidencia-critica.dlq";
    public static final String MAINTENANCE_DEAD_ROUTING_KEY = "mantenimiento.incidencia-critica.dead";

    private RabbitTopology() {
    }
}
