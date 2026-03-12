const { startJob, jobs, __test__ } = require('./job-manager');
const { JOB_STATUS } = require('../const');

// Mock child_process
jest.mock('child_process');
const { spawn } = require('child_process');

describe('job-manager', () => {
    let mockProc;

    beforeEach(() => {
        jobs.clear();
        __test__.resetState();
        jest.clearAllMocks();

        mockProc = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn()
        };

        spawn.mockReturnValue(mockProc);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('startJob', () => {
        it('should create a job with correct properties', () => {
            const jobName = 'test-job';
            const args = ['arg1', 'arg2'];

            const job = startJob(jobName, args);

            expect(job).toMatchObject({
                jobName,
                args,
                status: JOB_STATUS.RUNNING,
                retries: 0
            });
            expect(job.id).toBeDefined();
            expect(job.createdAt).toBeInstanceOf(Date);
        });

        it('should add job to jobs map', () => {
            const job = startJob('test-job', []);

            expect(jobs.has(job.id)).toBe(true);
            expect(jobs.get(job.id)).toBe(job);
        });

        it('should spawn a worker process with correct arguments', () => {
            const args = ['arg1', 'arg2', 'budget=1000'];

            startJob('test-job', args);

            expect(spawn).toHaveBeenCalledWith('node', expect.arrayContaining(args));
            expect(spawn.mock.calls[0][1][0]).toMatch(/worker\.js$/);
        });

        it('should set up event listeners on the spawned process', () => {
            startJob('test-job', []);

            expect(mockProc.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
            expect(mockProc.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
            expect(mockProc.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockProc.on).toHaveBeenCalledWith('exit', expect.any(Function));
        });
    });

    describe('process exit handling', () => {
        it('should mark job as completed on successful exit', () => {
            const job = startJob('test-job', []);
            const exitHandler = mockProc.on.mock.calls.find(call => call[0] === 'exit')[1];

            exitHandler(0); // exit code 0 = success

            expect(job.status).toBe(JOB_STATUS.COMPLETED);
            expect(job.exitCode).toBe(0);
            expect(job.completedAt).toBeInstanceOf(Date);
        });

        it('should retry job on failure if retries available', () => {
            const job = startJob('test-job', []);
            const exitHandler = mockProc.on.mock.calls.find(call => call[0] === 'exit')[1];

            exitHandler(1); // exit code 1 = failure

            // After retry, processQueue() sets status back to RUNNING
            expect(job.status).toBe(JOB_STATUS.RUNNING);
            expect(job.retries).toBe(1);
            // processQueue() is called after exit, which spawns the retry
            expect(spawn).toHaveBeenCalledTimes(2); // initial + 1 retry
        });

        it('should mark job as crashed after max retries', () => {
            const job = startJob('test-job', []);

            // Get all exit handlers
            const getExitHandler = (index = 0) => {
                const exitCalls = mockProc.on.mock.calls.filter(call => call[0] === 'exit');
                return exitCalls[index] ? exitCalls[index][1] : null;
            };

            // Get the exit handler from the first spawn
            let exitHandler = getExitHandler(0);
            expect(exitHandler).toBeDefined();

            // First failure - should retry (status becomes RUNNING after processQueue)
            exitHandler(1);
            expect(job.status).toBe(JOB_STATUS.RUNNING);
            expect(job.retries).toBe(1);

            // After retry, get the new exit handler from the second spawn
            exitHandler = getExitHandler(1);
            expect(exitHandler).toBeDefined();

            // Second failure - should crash (no more retries)
            exitHandler(1);

            expect(job.status).toBe(JOB_STATUS.CRASHED);
            expect(job.retries).toBe(1);
            expect(job.completedAt).toBeInstanceOf(Date);
        });

        it('should handle non-zero exit codes correctly', () => {
            const job = startJob('test-job', []);
            const exitCall = mockProc.on.mock.calls.find(call => call[0] === 'exit');
            expect(exitCall).toBeDefined();
            const exitHandler = exitCall[1];

            exitHandler(137); // any non-zero exit code

            expect(job.exitCode).toBe(137);
            // After retry, processQueue() sets status back to RUNNING
            expect(job.status).toBe(JOB_STATUS.RUNNING);
        });
    });
});
