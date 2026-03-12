const express = require('express');
const { startJob, jobs } = require('./services/job-manager');
const stats = require('./services/stats.service');

const app = express();
app.use(express.json());

app.post('/jobs', (req, res) => {
  const { jobName, arguments: args } = req.body;
  if (!jobName) {
    throw new Error('Job name is required');
  }
  if (!args.length) {
    throw new Error('Job arguments must be an array of strings');
  }
  const job = startJob(jobName, args || []);
  res.json(job);
})

app.get('/jobs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const allJobs = Array.from(jobs.values());
  const total = allJobs.length;
  const totalPages = Math.ceil(total / limit);

  // Validate page number
  if (page < 1) {
    return res.status(400).json({ error: 'Page must be greater than 0' });
  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedJobs = allJobs.slice(startIndex, endIndex);

  res.json({
    page,
    limit,
    total,
    totalPages,
    data: paginatedJobs
  });
})

app.get('/stats', (req, res) => {
  res.json(stats.generate(Array.from(jobs.values())));
});

app.listen(3000).on('listening', () => console.log('Server started on port 3000'));
