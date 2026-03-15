import { useState, useCallback } from "react";
import { ref, set, get, push, update } from "firebase/database";
import { db } from "../utils/firebaseConfig";

export const useBidding = (auctionId, playerId) => {
  const [currentBid, setCurrentBid] = useState(0);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getBidPath = () => `auctions/${auctionId}/bidding`;

  const incrementBid = useCallback(
    async (increment, groupMaxPrice, teamBudget) => {
      try {
        setLoading(true);
        setError(null);

        const newBid = currentBid + increment;

        // Validate against group max price
        if (groupMaxPrice && newBid > groupMaxPrice) {
          throw new Error(`Bid exceeds group max price of ${groupMaxPrice}`);
        }

        // Validate against team budget
        if (teamBudget && newBid > teamBudget) {
          throw new Error(`Bid exceeds team remaining budget of ${teamBudget}`);
        }

        setCurrentBid(newBid);
        setBidHistory((prev) => [...prev, { amount: newBid, action: "increment", timestamp: new Date().toISOString() }]);
        return newBid;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [auctionId, playerId, currentBid],
  );

  const decrementBid = useCallback(
    async (decrement, basePrice = 0) => {
      try {
        setLoading(true);
        setError(null);

        const newBid = Math.max(basePrice, currentBid - decrement);
        setCurrentBid(newBid);
        setBidHistory((prev) => [...prev, { amount: newBid, action: "decrement", timestamp: new Date().toISOString() }]);
        return newBid;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [currentBid],
  );

  const setBidAmount = useCallback(async (amount) => {
    try {
      setLoading(true);
      setError(null);

      if (amount < 0) {
        throw new Error("Bid amount cannot be negative");
      }

      setCurrentBid(amount);
      return amount;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addBidToHistory = useCallback((bidAmount, action = "increment") => {
    try {
      const newBidRecord = {
        amount: bidAmount,
        action,
        timestamp: new Date().toISOString(),
      };

      setBidHistory((prev) => [...prev, newBidRecord]);
      return newBidRecord;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const undoLastBid = useCallback((basePrice = 0) => {
    try {
      setLoading(true);
      setError(null);

      if (bidHistory.length === 0) {
        throw new Error("No bid history to undo");
      }

      const newHistory = bidHistory.slice(0, -1);
      setBidHistory(newHistory);

      // Set current bid to the previous bid or base price
      if (newHistory.length > 0) {
        setCurrentBid(newHistory[newHistory.length - 1].amount);
      } else {
        setCurrentBid(basePrice);
      }

      return newHistory;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [bidHistory]);

  const resetBid = useCallback((basePrice = 0) => {
    try {
      setLoading(true);
      setError(null);

      setCurrentBid(basePrice);
      setBidHistory([]);
      return basePrice;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    currentBid,
    bidHistory,
    loading,
    error,
    incrementBid,
    decrementBid,
    setBidAmount,
    addBidToHistory,
    undoLastBid,
    resetBid,
  };
};
