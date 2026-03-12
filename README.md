# Ad Job Monitor

A lightweight ad job monitoring and management system built with Express.js.

## Features

- Start and track background jobs
- View all jobs and their status
- Generate statistics

## Installation

```bash
npm install
```

## Usage

### Start the server (locally)

```bash
npm start
```

The server will start on port 3000.

### Run with Docker

Build and run using Docker only:

```bash
docker build -t job-monitor .
docker run --rm -p 3000:3000 --name job-monitor job-monitor
```

Or use Docker Compose:

```bash
docker compose up --build
```

When running in Docker, the server will be available on port 3000.

### Run tests

```bash
npm test
```

## API Endpoints

### Create a Job

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobName": "campaign-auto-test",
    "arguments": ["segmentA", "segmentB", "budget=2000"]
  }'
```

### List All Jobs

List jobs with pagination support.

**Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Number of jobs per page

**Examples:**

```bash
# Get first page with default limit (10 jobs)
curl http://localhost:3000/jobs

# Get first page with custom limit
curl "http://localhost:3000/jobs?limit=20"

# Get specific page
curl "http://localhost:3000/jobs?page=2&limit=10"
```

**Response:**

```json
{
  "page": 1,
  "limit": 10,
  "total": 45,
  "totalPages": 5,
  "data": [
    {
      "id": "job_1234567890_abc123",
      "jobName": "campaign-auto-test",
      "args": ["segmentA", "segmentB"],
      "status": "completed",
      "retries": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Job Statistics

```bash
curl http://localhost:3000/stats
```

Returns success rate and other job statistics.
