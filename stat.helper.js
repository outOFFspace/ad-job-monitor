function parseArgs(args) {
    const result = {};

    for (const arg of args) {
        const [key, value] = arg.split('=');
        result[key] = value;
    }

    return result;
}

function isShortVideoAd(job, shortDuration = 15) {
    const args = parseArgs(job.args);
    return (args?.format === 'video' && Number(args?.duration) <= shortDuration);
}

function isDiscountedPricing(job, discountThreshold = 10) {
    const args = parseArgs(job.args);
    return (
        args?.discount &&
        parseFloat(args.discount) >= discountThreshold
    );
}

module.exports = { isShortVideoAd, isDiscountedPricing };
