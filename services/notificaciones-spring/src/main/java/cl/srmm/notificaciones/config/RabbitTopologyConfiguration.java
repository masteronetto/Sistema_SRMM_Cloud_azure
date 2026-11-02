package cl.srmm.notificaciones.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;

@Configuration
@EnableRabbit
public class RabbitTopologyConfiguration {

    @Bean
    TopicExchange rentalExchange() {
        return new TopicExchange(RabbitTopology.RENTAL_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange rentalDeadLetterExchange() {
        return new TopicExchange(RabbitTopology.RENTAL_DLX, true, false);
    }

    @Bean
    Queue rentalQueue() {
        return QueueBuilder.durable(RabbitTopology.RENTAL_QUEUE)
                .deadLetterExchange(RabbitTopology.RENTAL_DLX)
                .deadLetterRoutingKey(RabbitTopology.RENTAL_DEAD_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue rentalDeadLetterQueue() {
        return QueueBuilder.durable(RabbitTopology.RENTAL_DLQ).build();
    }

    @Bean
    Binding rentalBinding(
            @Qualifier("rentalQueue") Queue rentalQueue,
            @Qualifier("rentalExchange") TopicExchange rentalExchange
    ) {
        return BindingBuilder.bind(rentalQueue)
                .to(rentalExchange)
                .with(RabbitTopology.RENTAL_ROUTING_KEY);
    }

    @Bean
    Binding rentalDeadLetterBinding(
            @Qualifier("rentalDeadLetterQueue") Queue rentalDeadLetterQueue,
            @Qualifier("rentalDeadLetterExchange") TopicExchange rentalDeadLetterExchange
    ) {
        return BindingBuilder.bind(rentalDeadLetterQueue)
                .to(rentalDeadLetterExchange)
                .with(RabbitTopology.RENTAL_DEAD_ROUTING_KEY);
    }

    @Bean
    TopicExchange logisticsExchange() {
        return new TopicExchange(RabbitTopology.LOGISTICS_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange logisticsDeadLetterExchange() {
        return new TopicExchange(RabbitTopology.LOGISTICS_DLX, true, false);
    }

    @Bean
    Queue logisticsQueue() {
        return QueueBuilder.durable(RabbitTopology.LOGISTICS_QUEUE)
                .deadLetterExchange(RabbitTopology.LOGISTICS_DLX)
                .deadLetterRoutingKey(RabbitTopology.LOGISTICS_DEAD_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue logisticsDeadLetterQueue() {
        return QueueBuilder.durable(RabbitTopology.LOGISTICS_DLQ).build();
    }

    @Bean
    Binding logisticsBinding(
            @Qualifier("logisticsQueue") Queue logisticsQueue,
            @Qualifier("logisticsExchange") TopicExchange logisticsExchange
    ) {
        return BindingBuilder.bind(logisticsQueue)
                .to(logisticsExchange)
                .with(RabbitTopology.LOGISTICS_ROUTING_KEY);
    }

    @Bean
    Binding logisticsDeadLetterBinding(
            @Qualifier("logisticsDeadLetterQueue") Queue logisticsDeadLetterQueue,
            @Qualifier("logisticsDeadLetterExchange") TopicExchange logisticsDeadLetterExchange
    ) {
        return BindingBuilder.bind(logisticsDeadLetterQueue)
                .to(logisticsDeadLetterExchange)
                .with(RabbitTopology.LOGISTICS_DEAD_ROUTING_KEY);
    }

    @Bean
    TopicExchange maintenanceExchange() {
        return new TopicExchange(RabbitTopology.MAINTENANCE_EXCHANGE, true, false);
    }

    @Bean
    TopicExchange maintenanceDeadLetterExchange() {
        return new TopicExchange(RabbitTopology.MAINTENANCE_DLX, true, false);
    }

    @Bean
    Queue maintenanceQueue() {
        return QueueBuilder.durable(RabbitTopology.MAINTENANCE_QUEUE)
                .deadLetterExchange(RabbitTopology.MAINTENANCE_DLX)
                .deadLetterRoutingKey(RabbitTopology.MAINTENANCE_DEAD_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue maintenanceDeadLetterQueue() {
        return QueueBuilder.durable(RabbitTopology.MAINTENANCE_DLQ).build();
    }

    @Bean
    Binding maintenanceBinding(
            @Qualifier("maintenanceQueue") Queue maintenanceQueue,
            @Qualifier("maintenanceExchange") TopicExchange maintenanceExchange
    ) {
        return BindingBuilder.bind(maintenanceQueue)
                .to(maintenanceExchange)
                .with(RabbitTopology.MAINTENANCE_ROUTING_KEY);
    }

    @Bean
    Binding maintenanceDeadLetterBinding(
            @Qualifier("maintenanceDeadLetterQueue") Queue maintenanceDeadLetterQueue,
            @Qualifier("maintenanceDeadLetterExchange") TopicExchange maintenanceDeadLetterExchange
    ) {
        return BindingBuilder.bind(maintenanceDeadLetterQueue)
                .to(maintenanceDeadLetterExchange)
                .with(RabbitTopology.MAINTENANCE_DEAD_ROUTING_KEY);
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        var factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        return factory;
    }
}
