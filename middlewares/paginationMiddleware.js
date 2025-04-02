/**
 * Middleware to add pagination parameters to the request
 */
const paginate = (req, res, next) => {
    // Get page and limit from query params
    const pageParam = parseInt(req.query.page, 10);
    const limitParam = parseInt(req.query.limit, 10);

    // Set defaults and validate
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 25 : limitParam;

    // Calculate offset
    const offset = (page - 1) * limit;

    // Add pagination object to the request
    req.pagination = {
        page,
        limit,
        offset
    };

    // Continue
    next();
};

/**
 * Helper function to build pagination metadata for response
 */
const getPaginationMetadata = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null
    };
};

module.exports = {
    paginate,
    getPaginationMetadata
};