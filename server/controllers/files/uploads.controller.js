exports.listUploads = async (_req, res) => {
  res.json({ rows: [] });      // TODO: replace with real data
};

exports.deleteUpload = async (req, res) => {
  res.json({ ok: true, deleted: req.params.id });
};