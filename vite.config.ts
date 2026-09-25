import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'local-drive-api',
        configureServer(server) {
          server.middlewares.use('/api/drive', async (request, response, next) => {
            if (request.method !== 'POST') return next();

            let body = '';
            request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            request.on('end', async () => {
              try {
                const parsedRequest = { ...request, body: body ? JSON.parse(body) : {} };
                const apiResponse = {
                  status: (code: number) => ({
                    json: (value: unknown) => {
                      response.statusCode = code;
                      response.setHeader('Content-Type', 'application/json');
                      response.end(JSON.stringify(value));
                    },
                  }),
                };

                const { default: driveHandler } = await import('./api/drive');
                await driveHandler(parsedRequest as any, apiResponse as any);
              } catch (error) {
                response.statusCode = 400;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({ error: error instanceof Error ? error.message : '无效请求' }));
              }
            });
          });
        },
      },
      {
        name: 'local-student-delete-api',
        configureServer(server) {
          server.middlewares.use('/api/student-delete', async (request, response, next) => {
            if (request.method !== 'POST') return next();

            let body = '';
            request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            request.on('end', async () => {
              try {
                const parsedRequest = { ...request, body: body ? JSON.parse(body) : {} };
                const apiResponse = {
                  status: (code: number) => ({
                    json: (value: unknown) => {
                      response.statusCode = code;
                      response.setHeader('Content-Type', 'application/json');
                      response.end(JSON.stringify(value));
                    },
                  }),
                };

                const { default: studentDeleteHandler } = await import('./api/student-delete');
                await studentDeleteHandler(parsedRequest as any, apiResponse as any);
              } catch (error) {
                response.statusCode = 400;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({ error: error instanceof Error ? error.message : '无效请求' }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});