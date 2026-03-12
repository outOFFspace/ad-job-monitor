const { spawn } = require('child_process');
const path = require('path');
const { JOB_STATUS, PROCESS_EXIT_CODE, MAX_RETRIES } = require('../const');
const jobs = new Map();
const queue = [];

const MAX_CONCURRENT_JOBS = 5;
let runningJobs = 0;

function processQueue() {
    while (runningJobs < MAX_CONCURRENT_JOBS && queue.length > 0) {
        const job = queue.shift();
        runningJobs++;
        job.status = JOB_STATUS.RUNNING;
        runProcess(job);
        console.log(`Job ${job.id} started with args: ${job.args}`);
    }
}

function startJob(jobName, args) {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const job = {
        id,
        jobName,
        args,
        status: JOB_STATUS.RUNNING,
        retries: 0,
        createdAt: new Date()
    };

    jobs.set(id, job);

    queue.push(job);

    processQueue();

    return job;
}

function runProcess(job) {
    const script = path.join(__dirname, '../jobs/worker.js');

    const proc = spawn('node', [script, ...job.args]);

    proc.stdout.on('data', (data) => {
        console.log(`worker stdout: ${data.toString()}`);
    });

    proc.stderr.on('data', (data) => {
        console.error(`worker stderr: ${data.toString()}`);
    });

    proc.on('error', (err) => {
        console.error('spawn error:', err);
    });

    proc.on('exit', (code) => {
        runningJobs--;
        job.exitCode = code;

        if (code === PROCESS_EXIT_CODE.SUCCESS) {
            job.status = JOB_STATUS.COMPLETED;
            job.completedAt = new Date();
            console.log(`Job ${job.id} completed successfully`);
        } else {
            if (job.retries < MAX_RETRIES) {
                job.status = JOB_STATUS.RETRIED;
                job.retries++;
                queue.push(job);
                console.log(`Job ${job.id} failed, retrying (${job.retries}/${MAX_RETRIES})...`);
            } else {
                job.status = JOB_STATUS.CRASHED;
                job.completedAt = new Date();
                console.error(`Job ${job.id} failed after ${job.retries} retries`);
            }
        }
        processQueue();
    });
}

module.exports = { startJob, jobs, __test__: { queue, resetState: () => { queue.length = 0; runningJobs = 0; } } };
