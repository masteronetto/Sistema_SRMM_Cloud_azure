package cl.srmm.kafka.bridge.config;

import cl.srmm.kafka.bridge.messaging.BridgeRabbitTopology;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@EnableRabbit
@Configuration
public class RabbitTopologyConfiguration {

    @Bean
    TopicExchange rentalExchange() {
        return new TopicExchange(BridgeRabbitTopology.RENTAL_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange rentalDeadLetterExchange() {
        return new TopicExchange(BridgeRabbitTopology.RENTAL_DLX, true, false);
    }

    @Bean
    Queue rentalQueue() {
        return bridgeQueue(BridgeRabbitTopology.RENTAL_QUEUE,
                BridgeRabbitTopology.RENTAL_DLX, BridgeRabbitTopology.RENTAL_DEAD_ROUTING_KEY);
    }

    @Bean
    Queue rentalDeadLetterQueue() {
        return QueueBuilder.durable(BridgeRabbitTopology.RENTAL_DLQ).build();
    }

    @Bean
    Binding rentalBinding(
            @Qualifier("rentalQueue") Queue queue,
            @Qualifier("rentalExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.RENTAL_ROUTING_KEY);
    }

    @Bean
    Binding rentalDeadLetterBinding(
            @Qualifier("rentalDeadLetterQueue") Queue queue,
            @Qualifier("rentalDeadLetterExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.RENTAL_DEAD_ROUTING_KEY);
    }

    @Bean
    TopicExchange logisticsExchange() {
        return new TopicExchange(BridgeRabbitTopology.LOGISTICS_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange logisticsDeadLetterExchange() {
        return new TopicExchange(BridgeRabbitTopology.LOGISTICS_DLX, true, false);
    }

    @Bean
    Queue logisticsQueue() {
        return bridgeQueue(BridgeRabbitTopology.LOGISTICS_QUEUE,
                BridgeRabbitTopology.LOGISTICS_DLX, BridgeRabbitTopology.LOGISTICS_DEAD_ROUTING_KEY);
    }

    @Bean
    Queue logisticsDeadLetterQueue() {
        return QueueBuilder.durable(BridgeRabbitTopology.LOGISTICS_DLQ).build();
    }

    @Bean
    Binding logisticsBinding(
            @Qualifier("logisticsQueue") Queue queue,
            @Qualifier("logisticsExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.LOGISTICS_ROUTING_KEY);
    }

    @Bean
    Binding logisticsDeadLetterBinding(
            @Qualifier("logisticsDeadLetterQueue") Queue queue,
            @Qualifier("logisticsDeadLetterExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.LOGISTICS_DEAD_ROUTING_KEY);
    }

    @Bean
    TopicExchange maintenanceExchange() {
        return new TopicExchange(BridgeRabbitTopology.MAINTENANCE_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange maintenanceDeadLetterExchange() {
        return new TopicExchange(BridgeRabbitTopology.MAINTENANCE_DLX, true, false);
    }

    @Bean
    Queue maintenanceQueue() {
        return bridgeQueue(BridgeRabbitTopology.MAINTENANCE_QUEUE,
                BridgeRabbitTopology.MAINTENANCE_DLX, BridgeRabbitTopology.MAINTENANCE_DEAD_ROUTING_KEY);
    }

    @Bean
    Queue maintenanceDeadLetterQueue() {
        return QueueBuilder.durable(BridgeRabbitTopology.MAINTENANCE_DLQ).build();
    }

    @Bean
    Binding maintenanceBinding(
            @Qualifier("maintenanceQueue") Queue queue,
            @Qualifier("maintenanceExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.MAINTENANCE_ROUTING_KEY);
    }

    @Bean
    Binding maintenanceDeadLetterBinding(
            @Qualifier("maintenanceDeadLetterQueue") Queue queue,
            @Qualifier("maintenanceDeadLetterExchange") TopicExchange exchange
    ) {
        return BindingBuilder.bind(queue).to(exchange).with(BridgeRabbitTopology.MAINTENANCE_DEAD_ROUTING_KEY);
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        return factory;
    }

    private Queue bridgeQueue(String name, String deadLetterExchange, String deadLetterRoutingKey) {
        return QueueBuilder.durable(name)
                .deadLetterExchange(deadLetterExchange)
                .deadLetterRoutingKey(deadLetterRoutingKey)
                .build();
    }
}
