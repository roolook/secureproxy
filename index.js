// index.js
const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'secureproxy-2.onrender.com';

// 1) CORS & rate limiting
app.use(cors());
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));

// 2) Allow iframe embedding
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });

// 3) Universal router: first path segment = hostname
app.use('/', createProxyMiddleware({
  changeOrigin: true,
  selfHandleResponse: true,

  // Choose target based on the first path segment
  router: req => {
    const m = req.url.match(/^\/([^\/]+)(?:\/|$)/);
    return m
      ? `https://${m[1]}`
      : `https://www.youtube.com`; // fallback
  },

  // Strip the first segment before proxying
  pathRewrite: (path, req) => {
    const m = path.match(/^\/([^\/]+)(\/.*|$)/);
    return m ? (m[2] || '/') : path;
  },

  onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
    // A) Rewrite Location headers
    const loc = proxyRes.headers.location;
    if (loc) {
      try {
        const u = new URL(loc);
        // rebuild so the client stays under our proxy
        proxyRes.headers.location = `https://${PROXY_HOST}/${u.host}${u.pathname}${u.search}`;
      } catch {}
    }

    // B) Rewrite Set-Cookie domains
    if (proxyRes.headers['set-cookie']) {
      proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(c =>
        c.replace(/Domain=[^;]+;?/i, '')
         .replace(/;?\s*Secure/gi, '')
         .concat(`; Domain=${PROXY_HOST}; Secure`)
      );
    }

    // C) If HTML, rewrite inline links
    const ct = proxyRes.headers['content-type']||'';
    if (ct.includes('text/html')) {
      let html = buffer.toString('utf8');
      // rewrite any hard‑coded https://*.google.com or youtube.com links
      html = html.replace(
        /https:\/\/([a-z0-9\-\.]+\.google\.com|www\.youtube\.com)/gi,
        (_, host) => `https://${PROXY_HOST}/${host}`
      );
      return Buffer.from(html, 'utf8');
    }

    return buffer;
  })
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listening on ${PORT}`));
