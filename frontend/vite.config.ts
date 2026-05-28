import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Mock /api/upload plugin for local Vite development
const mockUploadPlugin = () => ({
  name: 'mock-upload-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/upload' && req.method === 'POST') {
        try {
          // Simplistic multipart parser for single file in dev mode
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          // Get content type and boundary
          const contentType = req.headers['content-type'] || '';
          const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
          const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';

          if (!boundary) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No boundary in multipart form data' }));
            return;
          }

          // Locate the file data inside multipart boundary
          const boundaryBytes = Buffer.from('--' + boundary);
          const parts = [];
          let searchIndex = 0;

          while (true) {
            const index = buffer.indexOf(boundaryBytes, searchIndex);
            if (index === -1) break;
            parts.push(index);
            searchIndex = index + boundaryBytes.length;
          }

          // Read the first part where our file data lies
          if (parts.length < 2) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Failed to parse form data parts' }));
            return;
          }

          const filePart = buffer.subarray(parts[0] + boundaryBytes.length + 2, parts[1]);
          const headerEndIndex = filePart.indexOf('\r\n\r\n');
          if (headerEndIndex === -1) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Failed parsing file part header' }));
            return;
          }

          const headersText = filePart.subarray(0, headerEndIndex).toString();
          const fileData = filePart.subarray(headerEndIndex + 4, filePart.length - 2); // Exclude ending \r\n

          // Extract original filename or assign fallback
          const filenameMatch = headersText.match(/filename="([^"]+)"/i);
          const filename = filenameMatch ? filenameMatch[1] : 'uploaded_file.jpg';
          const fileExt = filename.split('.').pop() || 'jpg';
          const uniqueFilename = `${crypto.randomUUID()}.${fileExt}`;
          
          const uploadDir = path.resolve(process.cwd(), 'public/uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const filePath = path.join(uploadDir, uniqueFilename);
          fs.writeFileSync(filePath, fileData);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            filename: uniqueFilename,
            url: `/uploads/${uniqueFilename}`
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Handle GET /uploads/* locally in Vite Dev Mode
      if (req.url.startsWith('/uploads/') && req.method === 'GET') {
        const filename = req.url.split('/').pop();
        const filePath = path.resolve(process.cwd(), 'public/uploads', filename || '');
        if (fs.existsSync(filePath)) {
          const ext = filename?.split('.').pop() || 'jpg';
          res.setHeader('Content-Type', `image/${ext === 'png' ? 'png' : 'jpeg'}`);
          res.end(fs.readFileSync(filePath));
          return;
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mockUploadPlugin()],
  server: {
    proxy: {
      '/api/idms': {
        target: 'http://mobiledev.advanceagro.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/idms/, '/ws/api/idms')
      },
      '/api/hrms': {
        target: 'http://api-idms.advanceagro.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hrms/, '/hrms')
      }
    }
  }
})
