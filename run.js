import Agent from './src/agent.js';
import consumeAndIndex from "./src/vectorize.js";

const kafkaTopic = Date.now().toString();
const nick = new Agent('Nick', 'Judy', false, kafkaTopic, '\x1b[34m');
consumeAndIndex("Nick-reflections");
nick.start();

const judy = new Agent('Judy', 'Nick', true, kafkaTopic, '\x1b[32m');
judy.start();
consumeAndIndex("Judy-reflections");


