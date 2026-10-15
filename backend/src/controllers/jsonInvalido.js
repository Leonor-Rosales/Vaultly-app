module.exports = (error, _req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  next(error);
};
