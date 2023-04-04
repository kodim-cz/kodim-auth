import express from 'express';
import { kodimAuth } from '../dist/index.js';

const server = express();
server.use(express.json());

server.use('/test', kodimAuth());

server.get('/test', (req, res) => {
  res.send({ status: 'ok' });
});

server.listen(3000, () => {
  console.log('Listening on port 3000');
});
