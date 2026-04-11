/**
 * Calculates a matching score for a technician against a service request.
 * 
 * Weights:
 * - Distance: 35% (Closer is better, out of service_radius)
 * - Skill match: 25% (Request part skills matched by the technician)
 * - Rating: 25% (Higher is better, 5.0 max)
 * - Feedbacks: 15% (More experienced is better, up to 50 reviews)
 * 
 * @param {Object} technician - The technician profile (needs latitude, longitude, rating, total_reviews, service_radius)
 * @param {Number} distanceKm - The pre-calculated haversine distance in km
 * @param {Object} options
 * @param {Number[]} options.requestPartIds - Part IDs linked to the service request
 * @returns {Number} Total Score out of 100
 */
export function calculateTechnicianScore(technician, distanceKm, options = {}) {
    let score = 0;
    const requestPartIds = Array.isArray(options.requestPartIds)
        ? options.requestPartIds
        : [];
    const technicianPartIds = new Set(
        Array.isArray(technician.partSkills)
            ? technician.partSkills.map((skill) => skill.part_id)
            : []
    );

    // 1. Distance Score (Max 35 points)
    // If dist = 0, score = 35. If dist >= radius, score = 0.
    const radius = technician.service_radius || 50;
    if (distanceKm !== null && distanceKm !== undefined) {
        const distanceRatio = Math.max(0, 1 - (distanceKm / radius));
        score += distanceRatio * 35;
    } else {
        // If no coordinates provided, assume mid-range.
        score += 17.5;
    }

    // 2. Skill Match Score (Max 25 points)
    if (requestPartIds.length === 0) {
        // No diagnosed parts yet, so stay neutral instead of punishing anyone.
        score += 15;
    } else if (technicianPartIds.size > 0) {
        const matchedParts = requestPartIds.filter((partId) => technicianPartIds.has(partId)).length;
        const skillRatio = matchedParts / requestPartIds.length;
        score += skillRatio * 25;
    }

    // 3. Rating Score (Max 25 points)
    // Rating is out of 5.0. 
    const currentRating = parseFloat(technician.rating);
    if (!isNaN(currentRating) && currentRating > 0 && technician.total_reviews > 0) {
        const ratingRatio = currentRating / 5.0; // 0.0 to 1.0
        score += ratingRatio * 25;
    } else {
        // Give newer technicians a healthy baseline so they can still surface.
        score += 18;
    }

    // 4. Experience/Feedback Score (Max 15 points)
    // Cap the feedback benefit at 50 reviews to level the playing field.
    const reviewsCount = technician.total_reviews || 0;
    if (reviewsCount > 0) {
        const reviewRatio = Math.min(1.0, reviewsCount / 50.0);
        score += reviewRatio * 15;
    } else {
        score += 4;
    }

    return Math.round(score);
}
