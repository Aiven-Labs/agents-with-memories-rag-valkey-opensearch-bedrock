import Kafka from 'node-rdkafka';
import dotenv from 'dotenv';
dotenv.config();

// Create a producer
export const producer = new Kafka.Producer({
    'metadata.broker.list': process.env["KAFKA_SERVICE_URI"],
    'security.protocol': 'ssl',
    'ssl.key.location': process.env["ssl.key.location"],
    'ssl.certificate.location': process.env["ssl.certificate.location"],
    'ssl.ca.location': process.env["ssl.ca.location"],
    'dr_cb': true
});

producer.on('event.log', function (log) {
    console.log(log);
});

// Logging all errors
producer.on('event.error', function (err) {
    console.error(err);
});

producer.on('connection.failure', function (err) {
    console.error(err);
});

producer.on('delivery-report', function (err, report) {
    // console.log('Message was delivered' + JSON.stringify(report));
});

producer.on('disconnected', function (arg) {
    // console.log('producer disconnected. ' + JSON.stringify(arg));
});

producer.connect({}, (err) => {
    if (err) {
        console.error(err);
    }
});
