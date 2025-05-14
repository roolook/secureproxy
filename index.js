const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();

// CORS: Allow all origins (you can restrict this later)
app.use(cors());

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Secure proxy setup
const target = process.env.TARGET_URL || 'https://youtube.com';

app.use('/', createProxyMiddleware({
  target,
  changeOrigin: true,
  pathRewrite: {
    '^/': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // Optional: remove sensitive headers
    proxyReq.removeHeader('authorization');
  }
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy running on port ${port}, forwarding to ${target}`);
});
