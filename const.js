const JOB_STATUS = {
    RUNNING: 'running',
    COMPLETED: 'completed',
    RETRIED: 'retried',
    CRASHED: 'crashed'
}

const SUCCESS_RATE = 20;
const MAX_RETRIES = 1;
const PROCESS_EXIT_CODE = {
    SUCCESS: 0,
}

module.exports = { JOB_STATUS, SUCCESS_RATE, MAX_RETRIES, PROCESS_EXIT_CODE };
