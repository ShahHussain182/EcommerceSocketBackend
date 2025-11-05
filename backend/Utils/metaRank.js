import axios from "axios";

const METARANK_API = process.env.METARANK_API || 'http://localhost:8080';

export const trackEvent = async (event) => {
  try {
    await axios.post(`${METARANK_API}/api/events`, event);
  } catch (err) {
    console.error('MetaRank track error:', err.message);
  }
};

export const getRecommendations = async (userId, candidates) => {
  try {
    const res = await axios.post(`${METARANK_API}/api/recommend`, {
      user: userId,
      items: candidates.map((item) => ({ id: item._id })),
    });
    // MetaRank returns reordered list of IDs
    const rankedIds = res.data.items.map((i) => i.id);
    return rankedIds;
  } catch (err) {
    console.error('MetaRank recommend error:', err.message);
    return [];
  }
};
