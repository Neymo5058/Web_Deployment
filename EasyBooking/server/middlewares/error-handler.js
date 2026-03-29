export function notFoundHandler(req, res, next) {
  res.status(404).json({ message: 'Resource not found', path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}
