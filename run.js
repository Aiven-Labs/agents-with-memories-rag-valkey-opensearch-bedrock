import Agent from './src/agent.js';
import consumeAndIndex from "./src/vectorize.js";

const kafkaTopic = Date.now().toString();
const nick = new Agent('Nick', 'Judy', false, kafkaTopic);
consumeAndIndex("Nick-reflections");
nick.start();

const judy = new Agent('Judy', 'Nick', true, kafkaTopic);
judy.start();
consumeAndIndex("Judy-reflections");


