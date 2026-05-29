process.env.NODE_ENV = 'test';
const { app, server, wss, sessions, projectRooms } = require('./server');
const request = require('supertest');
const WebSocket = require('ws');

describe('Relay Server', () => {
  let wsServerPort;
  
  beforeAll((done) => {
    server.listen(0, () => {
      wsServerPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(done);
    });
  });

  beforeEach(() => {
    sessions.clear();
    projectRooms.clear();
  });

  test('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /sessions creates a new session', async () => {
    const res = await request(app).post('/sessions');
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('pairing_code');
    expect(res.body).toHaveProperty('session_secret');
    expect(res.body).toHaveProperty('expires_at');
    expect(sessions.size).toBe(1);
  });

  test('POST /sessions accepts a custom password', async () => {
    const res = await request(app).post('/sessions').send({ session_secret: 'my-custom-password' });
    expect(res.statusCode).toBe(201);
    expect(res.body.session_secret).toBe('my-custom-password');

    const controllerWs = new WebSocket(`ws://localhost:${wsServerPort}`);
    controllerWs.on('open', () => {
      controllerWs.send(JSON.stringify({
        type: 'join',
        role: 'controller',
        code: res.body.pairing_code,
        sessionSecret: 'my-custom-password'
      }));
    });
    controllerWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'joined') {
        controllerWs.close();
      }
    });
    await new Promise((resolve) => controllerWs.on('close', resolve));
  });

  test('POST /sessions rejects too-short custom passwords', async () => {
    const res = await request(app).post('/sessions').send({ session_secret: 'abc' });
    expect(res.statusCode).toBe(400);
  });

  test('WebSocket controller and renderer join', (done) => {
    request(app).post('/sessions').end((err, res) => {
      const { pairing_code, session_secret } = res.body;

      const controllerWs = new WebSocket(`ws://localhost:${wsServerPort}`);
      const rendererWs = new WebSocket(`ws://localhost:${wsServerPort}`);
      let controllerJoined = false;
      let rendererJoined = false;

      const checkDone = () => {
        if (controllerJoined && rendererJoined) {
          controllerWs.close();
          rendererWs.close();
          done();
        }
      };

      controllerWs.on('open', () => {
        controllerWs.send(JSON.stringify({
          type: 'join',
          role: 'controller',
          code: pairing_code,
          sessionSecret: session_secret
        }));
      });

      rendererWs.on('open', () => {
        rendererWs.send(JSON.stringify({
          type: 'join',
          role: 'renderer',
          code: pairing_code,
          sessionSecret: session_secret
        }));
      });

      controllerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'joined' && msg.role === 'controller') {
          controllerJoined = true;
          checkDone();
        }
      });

      rendererWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'joined' && msg.role === 'renderer') {
          rendererJoined = true;
          checkDone();
        }
      });
    });
  });

  test('project room broadcasts editor updates to multiple projectors', (done) => {
    const editorWs = new WebSocket(`ws://localhost:${wsServerPort}`);
    const projectorOne = new WebSocket(`ws://localhost:${wsServerPort}`);
    const projectorTwo = new WebSocket(`ws://localhost:${wsServerPort}`);
    const projectId = 'project_test';
    const received = new Set();

    const maybeDone = () => {
      if (received.size === 2) {
        editorWs.close();
        projectorOne.close();
        projectorTwo.close();
        done();
      }
    };

    editorWs.on('open', () => {
      editorWs.send(JSON.stringify({ type: 'project:join', role: 'editor', projectId }));
    });
    projectorOne.on('open', () => {
      projectorOne.send(JSON.stringify({ type: 'project:join', role: 'projector', projectId }));
    });
    projectorTwo.on('open', () => {
      projectorTwo.send(JSON.stringify({ type: 'project:join', role: 'projector', projectId }));
    });

    const sendUpdateWhenReady = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'project:presence' && msg.projectorCount === 2) {
        editorWs.send(JSON.stringify({ type: 'project:update', projectId, project: { id: projectId, name: 'Live' } }));
      }
    };

    editorWs.on('message', sendUpdateWhenReady);
    projectorOne.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'project:update' && msg.project.name === 'Live') {
        received.add('one');
        maybeDone();
      }
    });
    projectorTwo.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'project:update' && msg.project.name === 'Live') {
        received.add('two');
        maybeDone();
      }
    });
  });
});
