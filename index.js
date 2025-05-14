const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Allow all origins (you can restrict this later)
app.use(cors());

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per IP per window
});
app.use(limiter);

// Remove X-Frame-Options header to allow embedding
app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");  // Allow embedding
  next();
});

// Proxy to YouTube
const target = 'https://www.youtube.com';

app.use('/', createProxyMiddleware({
  target,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Rewrite all relative paths to include the proxy URL
    return path.replace(/^\/?/, '/');
  },
  onProxyReq: (proxyReq, req, res) => {
    // Change all absolute links to stay within the proxy
    proxyReq.setHeader('Host', 'www.youtube.com');  // Ensure it's proxied through YouTube
  },
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy running on port ${port}, forwarding to ${target}`);
});
