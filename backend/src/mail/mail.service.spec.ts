import * as net from 'net';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

/**
 * A synthetic SMTP endpoint on 127.0.0.1 that speaks just enough SMTP for nodemailer's verify():
 * greeting, EHLO, AUTH PLAIN / AUTH LOGIN, QUIT. It records every connection, every credential
 * pair it is given and every command, so the tests can prove what reached the server and that no
 * message (MAIL FROM / DATA) was ever started. Never a real SMTP host.
 */
interface SyntheticSmtp {
  port: number;
  connections: number;
  auths: { user: string; pass: string }[];
  commands: string[];
  close: () => Promise<void>;
}

function startSyntheticSmtp(accept: {
  user: string;
  pass: string;
}): Promise<SyntheticSmtp> {
  const state: Omit<SyntheticSmtp, 'port' | 'close'> = {
    connections: 0,
    auths: [],
    commands: [],
  };
  const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');
  const server = net.createServer((socket) => {
    state.connections += 1;
    let buffer = '';
    let loginStep: 'user' | 'pass' | null = null;
    let loginUser = '';
    const reply = (line: string) => socket.write(`${line}\r\n`);
    const finishAuth = (user: string, pass: string) => {
      state.auths.push({ user, pass });
      reply(
        user === accept.user && pass === accept.pass
          ? '235 2.7.0 Authentication successful'
          : '535 5.7.8 Authentication credentials invalid',
      );
    };
    reply('220 synthetic.invalid ESMTP test endpoint');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let i: number;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (loginStep === 'user') {
          loginUser = decode(line);
          loginStep = 'pass';
          reply('334 UGFzc3dvcmQ6');
          continue;
        }
        if (loginStep === 'pass') {
          loginStep = null;
          finishAuth(loginUser, decode(line));
          continue;
        }
        const verb = line.split(' ')[0].toUpperCase();
        state.commands.push(verb);
        if (verb === 'EHLO' || verb === 'HELO') {
          socket.write('250-synthetic.invalid\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (verb === 'AUTH') {
          const [, mech, initial] = line.split(' ');
          if (mech.toUpperCase() === 'PLAIN' && initial) {
            const [, user, pass] = decode(initial).split('\u0000');
            finishAuth(user, pass);
          } else if (mech.toUpperCase() === 'LOGIN') {
            loginStep = 'user';
            reply('334 VXNlcm5hbWU6');
          } else {
            reply('504 5.5.4 Unsupported');
          }
        } else if (verb === 'QUIT') {
          reply('221 2.0.0 Bye');
          socket.end();
        } else {
          reply('502 5.5.1 Not implemented by the synthetic endpoint');
        }
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        ...state,
        get connections() {
          return state.connections;
        },
        port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

describe('MailService.testConnection', () => {
  const env: Record<string, string> = {
    SMTP_HOST: 'smtp.env-server.invalid',
    SMTP_USER: 'env-user',
    SMTP_PASS: 'env-secret',
  };
  const config = new ConfigService(env);
  let smtp: SyntheticSmtp;
  let service: MailService;

  beforeEach(async () => {
    smtp = await startSyntheticSmtp({ user: 'alice', pass: 'right-pass' });
    service = new MailService(config);
    // Loopback is refused for real requests; allow exactly the synthetic endpoint here.
    jest
      .spyOn(service, 'isValidSmtpHost')
      .mockImplementation((host) => host === '127.0.0.1');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await smtp.close();
  });

  it('authenticates with the submitted credentials and sends no message', async () => {
    const result = await service.testConnection({
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      user: 'alice',
      password: 'right-pass',
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('No email was sent');
    expect(smtp.auths).toEqual([{ user: 'alice', pass: 'right-pass' }]);
    expect(smtp.commands).not.toContain('MAIL');
    expect(smtp.commands).not.toContain('DATA');
  });

  it('reports a failed login and never falls back to the environment credentials', async () => {
    const result = await service.testConnection({
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      user: 'alice',
      password: 'wrong-pass',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
    expect(smtp.auths).toEqual([{ user: 'alice', pass: 'wrong-pass' }]);
    expect(JSON.stringify(smtp.auths)).not.toContain('env-secret');
  });

  it('refuses placeholder and local hosts without opening a connection', async () => {
    jest.restoreAllMocks();
    for (const host of ['localhost', '127.0.0.1', 'smtp.example.com', 'x']) {
      const result = await service.testConnection({
        host,
        port: smtp.port,
        user: 'alice',
        password: 'right-pass',
      });
      expect(result.success).toBe(false);
    }
    expect(smtp.connections).toBe(0);
  });

  it('reports an unreachable server as a connection failure', async () => {
    const closedPort = smtp.port;
    await smtp.close();
    smtp = await startSyntheticSmtp({ user: 'x', pass: 'y' });
    const result = await service.testConnection({
      host: '127.0.0.1',
      port: closedPort,
      secure: false,
      user: 'alice',
      password: 'right-pass',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Cannot connect/);
  });
});
