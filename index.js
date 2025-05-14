// index.js
const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'secureproxy-2.onrender.com';
const TARGET = 'https://www.youtube.com';

// 1) CORS & rate limiting
app.use(cors());
app.use(rateLimit({ windowMs:15*60*1000, max:200 }));

// 2) Allow iframe embedding
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
});

// 3) Proxy with redirect & cookie rewriting + HTML link rewrite
app.use('/', createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  selfHandleResponse: true,

  onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
    // A) Rewrite Location header
    if (proxyRes.headers.location) {
      try {
        const u = new URL(proxyRes.headers.location);
        proxyRes.headers.location = `https://${PROXY_HOST}${u.pathname}${u.search}`;
      } catch {}
    }

    // B) Rewrite Set-Cookie domains
    if (proxyRes.headers['set-cookie']) {
      proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie =>
        cookie
          .replace(/Domain=[^;]+;?/gi, '')
          .replace(/;?\s*Secure/gi, '')
          .concat(`; Domain=${PROXY_HOST}; Secure`)
      );
    }

    // C) If HTML, rewrite in-page youtube.com → proxy
    const ct = proxyRes.headers['content-type'] || '';
    if (ct.includes('text/html')) {
      let html = buffer.toString('utf8');
      html = html.replace(/https:\/\/(www\.)?youtube\.com/gi, `https://${PROXY_HOST}`);
      return Buffer.from(html, 'utf8');
    }

    // D) Otherwise, return untouched
    return buffer;
  })
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy up on ${PORT}, to ${TARGET}`));
