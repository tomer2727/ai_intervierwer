
import Fastify from 'fastify';
import WebSocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { interviewMachine } from './fsm/machine';
import { createActor } from 'xstate';

dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(WebSocket);

fastify.register(async (fastify) => {
  fastify.get('/', async (request, reply) => {
    return { hello: 'world' };
  });

  fastify.get('/ws', { websocket: true }, (connection, req) => {
    connection.socket.on('message', message => {
      // connecting to agent logic here
      connection.socket.send('echo: ' + message);
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
