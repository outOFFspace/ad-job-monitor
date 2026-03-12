const { generate } = require('./stats.service');
const { JOB_STATUS } = require('../const');

// Mock the stat.helper module
jest.mock('../stat.helper', () => ({
    isShortVideoAd: jest.fn(),
    isDiscountedPricing: jest.fn()
}));

const { isShortVideoAd, isDiscountedPricing } = require('../stat.helper');

describe('stats.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isShortVideoAd.mockReturnValue(false);
        isDiscountedPricing.mockReturnValue(false);
    });

    describe('generate', () => {
        it('should return zero stats for empty job list', () => {
            const result = generate([]);

            expect(result).toEqual({
                summary: {
                    totalJobs: 0,
                    successfulJobs: 0,
                    failedJobs: 0,
                    overallSuccessRate: 0
                },
                insights: []
            });
        });

        it('should return zero stats for jobs with no finished jobs', () => {
            const jobs = [
                { id: 'job_1', status: JOB_STATUS.RUNNING, args: [] },
                { id: 'job_2', status: JOB_STATUS.RETRIED, args: [] }
            ];

            const result = generate(jobs);

            expect(result).toEqual({
                summary: {
                    totalJobs: 0,
                    successfulJobs: 0,
                    failedJobs: 0,
                    overallSuccessRate: 0
                },
                insights: []
            });
        });

        it('should calculate overall success rate correctly', () => {
            const jobs = [
                { id: 'job_1', status: JOB_STATUS.COMPLETED, args: [] },
                { id: 'job_2', status: JOB_STATUS.COMPLETED, args: [] },
                { id: 'job_3', status: JOB_STATUS.CRASHED, args: [] },
                { id: 'job_4', status: JOB_STATUS.CRASHED, args: [] }
            ];

            const result = generate(jobs);

            expect(result.summary.totalJobs).toBe(4);
            expect(result.summary.successfulJobs).toBe(2);
            expect(result.summary.failedJobs).toBe(2);
            expect(result.summary.overallSuccessRate).toBe(0.5);
        });

        it('should only count completed and crashed jobs', () => {
            const jobs = [
                { id: 'job_1', status: JOB_STATUS.COMPLETED, args: [] },
                { id: 'job_2', status: JOB_STATUS.RUNNING, args: [] },
                { id: 'job_3', status: JOB_STATUS.RETRIED, args: [] },
                { id: 'job_4', status: JOB_STATUS.CRASHED, args: [] }
            ];

            const result = generate(jobs);

            expect(result.summary.totalJobs).toBe(2);
        });

        describe('insight analysis', () => {
            it('should analyze young audience insight', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['audience=young', 'segment=A'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['audience=young', 'segment=B'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['audience=old'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['segment=C'] }
                ];

                const result = generate(jobs);

                const youngAudienceInsight = result.insights.find(i => i.title === 'Young audience campaigns succeed');
                expect(youngAudienceInsight).toBeDefined();
                expect(youngAudienceInsight.jobsAnalyzed).toBe(2);
                expect(youngAudienceInsight.successRate).toBe(1);
                expect(youngAudienceInsight.impact).toBe('+50%'); // 100% vs 50% overall
                expect(youngAudienceInsight.criteria).toEqual({ audience: "young" });
                expect(youngAudienceInsight.recommendation).toBeDefined();
            });

            it('should analyze budget argument insight', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['budget=1000'] },
                    { id: 'job_2', status: JOB_STATUS.CRASHED, args: ['budget=2000'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['segment=A'] }
                ];

                const result = generate(jobs);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight).toBeDefined();
                expect(budgetInsight.jobsAnalyzed).toBe(2);
                expect(budgetInsight.successRate).toBe(0.5);
            });

            it('should analyze discounted pricing pattern using helper', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['discount=15'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['discount=20'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['discount=5'] }
                ];

                // Mock the helper to return true for discount >= 10
                isDiscountedPricing.mockImplementation((job, threshold) => {
                    const discountArg = job.args.find(a => a.includes('discount='));
                    if (!discountArg) return false;
                    const discount = parseInt(discountArg.split('=')[1]);
                    return discount >= threshold;
                });

                const result = generate(jobs);

                const discountInsight = result.insights.find(i => i.title === 'Discounted pricing boosts success');
                expect(discountInsight).toBeDefined();
                expect(discountInsight.jobsAnalyzed).toBe(2);
                expect(discountInsight.successRate).toBe(1);
            });

            it('should analyze short video ad pattern using helper', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['format=video', 'duration=10'] },
                    { id: 'job_2', status: JOB_STATUS.CRASHED, args: ['format=video', 'duration=30'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['format=image'] }
                ];

                // Mock the helper to return true for short videos
                isShortVideoAd.mockImplementation((job, shortDuration) => {
                    const hasVideo = job.args.some(a => a.includes('format=video'));
                    const durationArg = job.args.find(a => a.includes('duration='));
                    if (!hasVideo || !durationArg) return false;
                    const duration = parseInt(durationArg.split('=')[1]);
                    return duration <= shortDuration;
                });

                const result = generate(jobs);

                const videoInsight = result.insights.find(i => i.title === 'Short video ads perform best');
                expect(videoInsight).toBeDefined();
                expect(videoInsight.jobsAnalyzed).toBe(1);
            });

            it('should calculate impact correctly', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['budget=1000'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['budget=2000'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['budget=3000'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['segment=A'] }
                ];

                const result = generate(jobs);

                expect(result.summary.overallSuccessRate).toBe(0.75);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight.successRate).toBe(1);
                expect(budgetInsight.impact).toBe('+25%');
            });

            it('should handle negative impact', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['segment=B'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['budget=1000'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['budget=2000'] }
                ];

                const result = generate(jobs);

                expect(result.summary.overallSuccessRate).toBe(0.5); // 2 out of 4

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight.successRate).toBe(0); // 0 out of 2
                expect(budgetInsight.impact).toBe('-50%'); // 0% - 50%
            });

            it('should round success rates to 2 decimal places', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['budget=1000'] },
                    { id: 'job_2', status: JOB_STATUS.CRASHED, args: ['segment=A'] },
                    { id: 'job_3', status: JOB_STATUS.CRASHED, args: ['segment=B'] }
                ];

                const result = generate(jobs);

                expect(result.summary.overallSuccessRate).toBe(0.33);
            });

            it('should not include insights with no matches', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_2', status: JOB_STATUS.CRASHED, args: ['segment=B'] }
                ];

                const result = generate(jobs);

                expect(result.insights.length).toBe(0);
            });
        });

        describe('dynamic recommendations', () => {
            it('should generate strong positive recommendation for impact > 0.05', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['audience=young'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['audience=young'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['audience=young'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['segment=A'] }
                ];

                const result = generate(jobs);

                const youngAudienceInsight = result.insights.find(i => i.title === 'Young audience campaigns succeed');
                expect(youngAudienceInsight).toBeDefined();
                expect(youngAudienceInsight.recommendation).toContain('Strong positive correlation');
                expect(youngAudienceInsight.recommendation).toContain('Consider prioritizing this configuration');
            });

            it('should generate slight positive recommendation for 0 < impact <= 0.05', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['budget=1000'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['budget=2000'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_4', status: JOB_STATUS.COMPLETED, args: ['segment=B'] },
                    { id: 'job_5', status: JOB_STATUS.CRASHED, args: ['segment=C'] }
                ];

                const result = generate(jobs);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight).toBeDefined();
                // Impact should be small: 100% vs 80% = +20%, which is 0.2, so it should be "strong positive"
                // Let's check the actual impact
                expect(budgetInsight.impact).toBe('+20%');
                expect(budgetInsight.recommendation).toContain('Strong positive correlation');
            });

            it('should generate strong negative recommendation for impact < -0.05', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['segment=B'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['segment=C'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['budget=1000'] },
                    { id: 'job_5', status: JOB_STATUS.CRASHED, args: ['budget=2000'] }
                ];

                const result = generate(jobs);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight).toBeDefined();
                expect(budgetInsight.recommendation).toContain('significantly reduces success rates');
                expect(budgetInsight.recommendation).toContain('Consider avoiding this setup');
            });

            it('should generate slight negative recommendation for -0.05 <= impact < 0', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_2', status: JOB_STATUS.COMPLETED, args: ['segment=B'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['segment=C'] },
                    { id: 'job_4', status: JOB_STATUS.COMPLETED, args: ['segment=D'] },
                    { id: 'job_5', status: JOB_STATUS.COMPLETED, args: ['segment=E'] },
                    { id: 'job_6', status: JOB_STATUS.CRASHED, args: ['segment=F'] },
                    { id: 'job_7', status: JOB_STATUS.CRASHED, args: ['budget=1000'] }
                ];

                const result = generate(jobs);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight).toBeDefined();
                // Impact: 0% vs 71% = -71%, which is -0.71
                // This should trigger "significantly reduces"
                expect(budgetInsight.recommendation).toContain('significantly reduces');
            });

            it('should generate neutral recommendation for impact = 0', () => {
                const jobs = [
                    { id: 'job_1', status: JOB_STATUS.COMPLETED, args: ['budget=1000'] },
                    { id: 'job_2', status: JOB_STATUS.CRASHED, args: ['budget=2000'] },
                    { id: 'job_3', status: JOB_STATUS.COMPLETED, args: ['segment=A'] },
                    { id: 'job_4', status: JOB_STATUS.CRASHED, args: ['segment=B'] }
                ];

                const result = generate(jobs);

                const budgetInsight = result.insights.find(i => i.title === 'Budget allocation matters');
                expect(budgetInsight).toBeDefined();
                expect(budgetInsight.impact).toBe('+0%');
                expect(budgetInsight.recommendation).toContain('No clear impact detected');
            });
        });
    });
});
