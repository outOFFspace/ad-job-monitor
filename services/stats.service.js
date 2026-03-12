const { JOB_STATUS } = require('../const');
const { isShortVideoAd, isDiscountedPricing } = require('../stat.helper');

function generateRecommendation(pattern, impact) {
    if (impact > 0.05) {
        return `Strong positive correlation detected for ${pattern}. Consider prioritizing this configuration.`;
    }

    if (impact > 0) {
        return `${pattern} slightly improves success rates. Worth exploring further.`;
    }

    if (impact < -0.05) {
        return `${pattern} significantly reduces success rates. Consider avoiding this setup.`;
    }

    if (impact < 0) {
        return `${pattern} shows slightly worse performance than average. Monitor or adjust strategy.`;
    }

    return `No clear impact detected for ${pattern}.`;
}

function generateInsights(finishedJobs, overallSuccessRate) {
    function analyze(title, criteria, predicate) {
        const matches = finishedJobs.filter(predicate);
        if (matches.length === 0) {
            return null;
        }

        const successes = matches.filter(j => j.status === JOB_STATUS.COMPLETED).length;
        const successRate = successes / matches.length;

        const diff = successRate - overallSuccessRate;

        return {
            title,
            criteria,
            jobsAnalyzed: matches.length,
            successRate: Number(successRate.toFixed(2)),
            impact: (diff >= 0 ? '+' : '') + Math.round(diff * 100) + '%',
            recommendation: generateRecommendation(title, diff)
        }
    }

    const insights = [];

    const i1 = analyze(
        'Short video ads perform best',
        { format: 'video', duration: '<=15' },
        j => isShortVideoAd(j, 15)
    );

    const i2 = analyze(
        'Discounted pricing boosts success',
        { discount: '>=10%' },
        j => isDiscountedPricing(j, 10)
    );

    const i3 = analyze(
        'Gaming audience campaigns underperform',
        { audience: 'gamers' },
        j => (j.args || []).some(a => a.includes('audience=gamers'))
    );

    const i4 = analyze(
        'Young audience campaigns succeed',
        { audience: 'young' },
        j => (j.args || []).some(a => a.includes('audience=young'))
    );

    const i5 = analyze(
        "Budget allocation matters",
        { budget: 'present' },
        j => (j.args || []).some(a => a.includes('budget'))
    );

    [i1, i2, i3, i4, i5].forEach(insight => {
        if (insight) insights.push(insight);
    });

    return insights;
}

function generate(jobs) {
    const finishedJobs = jobs.filter(j => j.status === JOB_STATUS.COMPLETED || j.status === JOB_STATUS.CRASHED);
    const totalJobs = finishedJobs.length;

    if (totalJobs === 0) {
        return {
            summary: {
                totalJobs: 0,
                successfulJobs: 0,
                failedJobs: 0,
                overallSuccessRate: 0
            },
            insights: []
        }
    }

    const successfulJobs = finishedJobs.filter(j => j.status === JOB_STATUS.COMPLETED).length;
    const failedJobs = totalJobs - successfulJobs;
    const overallSuccessRate = successfulJobs / totalJobs;
    const insights = generateInsights(finishedJobs, overallSuccessRate);

    return {
        summary: {
            totalJobs,
            successfulJobs,
            failedJobs,
            overallSuccessRate: Number(overallSuccessRate.toFixed(2))
        },
        insights
    }
}

module.exports = { generate };
