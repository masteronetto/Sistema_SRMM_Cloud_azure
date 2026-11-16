package cl.srmm.kafka.bridge.messaging;

public final class BridgeRabbitTopology {

    public static final String RENTAL_EXCHANGE = "srmm.arriendos";
    public static final String RENTAL_ROUTING_KEY = "arriendo.creado";
    public static final String RENTAL_QUEUE = "kafka.bridge.arriendos.q";
    public static final String RENTAL_DLX = "srmm.arriendos.dlx";
    public static final String RENTAL_DLQ = "kafka.bridge.arriendos.dlq";
    public static final String RENTAL_DEAD_ROUTING_KEY = "kafka.bridge.arriendos.dead";

    public static final String LOGISTICS_EXCHANGE = "srmm.logistica";
    public static final String LOGISTICS_ROUTING_KEY = "logistica.estado-cambiado";
    public static final String LOGISTICS_QUEUE = "kafka.bridge.logistica.q";
    public static final String LOGISTICS_DLX = "srmm.logistica.dlx";
    public static final String LOGISTICS_DLQ = "kafka.bridge.logistica.dlq";
    public static final String LOGISTICS_DEAD_ROUTING_KEY = "kafka.bridge.logistica.dead";

    public static final String MAINTENANCE_EXCHANGE = "srmm.mantenimientos";
    public static final String MAINTENANCE_ROUTING_KEY = "mantenimiento.incidencia-critica";
    public static final String MAINTENANCE_QUEUE = "kafka.bridge.mantenimientos.q";
    public static final String MAINTENANCE_DLX = "srmm.mantenimientos.dlx";
    public static final String MAINTENANCE_DLQ = "kafka.bridge.mantenimientos.dlq";
    public static final String MAINTENANCE_DEAD_ROUTING_KEY = "kafka.bridge.mantenimientos.dead";

    private BridgeRabbitTopology() {
    }
}
