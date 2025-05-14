// index.js
const express = require('express');
const {
  createProxyMiddleware,
  responseInterceptor,
} = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const URL = require('url').URL;

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'secureproxy-2.onrender.com';
const TARGET = 'https://www.youtube.com';

// 1. CORS & rate limiting
app.use(cors());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

// 2. Remove X-Frame-Options so you can embed
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
});

// 3. The proxy itself
app.use(
  '/',
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    selfHandleResponse: true,

    // A) Handle redirects back through proxy
    onProxyRes(proxyRes, req, res) {
      // 3.A.1 Rewrite Location headers
      const loc = proxyRes.headers['location'];
      if (loc) {
        try {
          const u = new URL(loc);
          // rebuild the URL to go via your proxy
          proxyRes.headers['location'] = `https://${PROXY_HOST}${u.pathname}${u.search}`;
        } catch (e) {}
      }

      // 3.A.2 Rewrite Set-Cookie domains
      const cookies = proxyRes.headers['set-cookie'];
      if (cookies) {
        proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
          // strip Domain=... and add our proxy domain instead
          cookie
            .replace(/Domain=[^;]+;?/gi, '')
            .replace(/;?\s*Secure/gi, '') + `; Domain=${PROXY_HOST}; Secure`
        );
      }
    },

    // B) Intercept HTML/JS and rewrite any in‑page youtube.com links
    //    (WARNING: may break some dynamic scripts!)
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let html = responseBuffer.toString('utf8');
        // Rewrite absolute links in the HTML
        html = html.replace(
          /https:\/\/(www\.)?youtube\.com/gi,
          `https://${PROXY_HOST}`
        );
        return Buffer.from(html, 'utf8');
      }
      // otherwise, return unmodified
      return responseBuffer;
    }),
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Proxy listening on ${PORT}, forwarding to ${TARGET}`)
);
