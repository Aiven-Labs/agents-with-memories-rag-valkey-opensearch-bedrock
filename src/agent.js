import { invokeModel, sendToChannel, subscribe, delay } from './common.js';
import { producer } from "./producer.js";
import { consumeAll } from "./consumer.js";
import { LongMemoryService } from './longTermMemory.js';
import {
    getMemoryPrompt,
    getContinuationMemoryPrompt,
    getStartConversationPrompt,
    getContinueConversationPrompt,
    getConversationSummaryPrompt
} from './prompts.js';

class Agent {
    constructor(agentName, anotherAgent, starts,conversationTopic) {
        console.log({ conversationTopic })
        this.agentName = agentName;
        this.anotherAgent = anotherAgent;
        this.shortMemory = [];
        this.starts = starts;
        this.conversationTopic = conversationTopic;

        this.longMemoryService = new LongMemoryService(`${this.agentName.toLowerCase()}-reflections`);
    }

    async queryLongTermMemory(message) {
        const longmemory = await this.longMemoryService.getLongMemory(`\n\nHuman: ${message} \n\nAssistant:`);
        console.log("******* " + this.agentName.toUpperCase() + " LONG MEMORY: " + longmemory);
        console.log("************************************************************************************");
        return longmemory;
    }

    async getPrompt(message) {
        // start of the conversation:
        if (!message) {
            const memoriesOfOtherAgent = await this.queryLongTermMemory(getMemoryPrompt(this.agentName, this.anotherAgent));
            return getStartConversationPrompt(this.agentName, memoriesOfOtherAgent);
        }

        // continuation of the conversation:
        let memoryString = this.shortMemory.join('\n');
        let longTermMemory = await this.queryLongTermMemory(getContinuationMemoryPrompt(this.agentName, this.anotherAgent, message));
        return getContinueConversationPrompt(this.agentName, memoryString, longTermMemory, message);
    }

    async getConversationSummary(content) {
        const prompt = getConversationSummaryPrompt(this.agentName, content);
        return await invokeModel(prompt);
    }

    storeInKafka(topic, message) {
        producer.produce(
            topic,
            null,
            Buffer.from(message),
            null,
            Date.now()
        );
        producer.flush();
    }

    async triggerReflection(recipient) {
        await sendToChannel(`${recipient}-internalize`, "Reflect on the conversation");
        await sendToChannel(`${this.agentName}-internalize`, "Reflect on the conversation");
    }

    async replyToMessage(recipient, message) {
        //agent indicated that no longer wants to continue conversation
        if (message && message.includes("END")) {
            console.log("trigger reflection")
            return await this.triggerReflection(recipient);
        }

        const prompt = await this.getPrompt(message);
        console.log(`### ${this.agentName.toUpperCase()} PROMPT: ###`)
        console.log("prompt: " + this.agentName, prompt)
        const response = await invokeModel(prompt);
        console.log(`=== ${this.agentName.toUpperCase()} SAYS: ===`)
        console.log(`${response}`);
        if (message) {
            this.shortMemory.push(`${recipient} said: ${message}`)
        }

        this.shortMemory.push(`You replied: ${response}`);
        sendToChannel(recipient, JSON.stringify({agent: this.agentName, message: response}));
    }

    async reflect() {
        const messages = await consumeAll(this.conversationTopic, `${this.conversationTopic}-${this.agentName}`);
        const summary = await this.getConversationSummary(messages.join("; "));
        this.storeInKafka(`${this.agentName}-reflections`, summary);
    }

    startToListenToOthers() {
        const subscriber = subscribe(this.agentName);
        subscriber.on('message', async (channel, message) => {
            const parsedMessage = JSON.parse(message);

            this.storeInKafka(this.conversationTopic, message);
            await delay(1000);
            await this.replyToMessage(parsedMessage.agent, parsedMessage.message);
        });
    }

    waitToConversationEnd() {
        const subscriber = subscribe( `${this.agentName}-internalize`);
        subscriber.on('message', async (channel) => {
            if (channel !== `${this.agentName}-internalize`) return;

            await this.reflect();
        });
    }

    async startConversation(recipient) {
        await this.replyToMessage(recipient);
    }

    async start() {
        // listen what another agent tells you
        this.startToListenToOthers();
        // get ready to process the conversation

        this.waitToConversationEnd();

        if (this.starts) {
            await this.startConversation(this.anotherAgent);
        }
    }
}

export default Agent;
