import { useState, useCallback } from "react";
import { ref, set, push, get, update, remove } from "firebase/database";
import { db } from "../utils/firebaseConfig";

export const useAuction = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createAuction = useCallback(async (auctionData) => {
    try {
      setLoading(true);
      setError(null);

      const auctionsRef = ref(db, "auctions");
      const newAuctionRef = push(auctionsRef);

      const auction = {
        ...auctionData,
        createdAt: new Date().toISOString(),
        status: "setup",
      };

      await set(newAuctionRef, auction);
      return newAuctionRef.key;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTeam = useCallback(async (auctionId, teamData) => {
    try {
      setLoading(true);
      setError(null);

      const teamsRef = ref(db, `auctions/${auctionId}/teams`);
      const newTeamRef = push(teamsRef);

      const team = {
        ...teamData,
        budget_remaining: teamData.budget_total,
        squad: [],
        createdAt: new Date().toISOString(),
      };

      await set(newTeamRef, team);
      return newTeamRef.key;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addGroup = useCallback(async (auctionId, groupData) => {
    try {
      setLoading(true);
      setError(null);

      const groupsRef = ref(db, `auctions/${auctionId}/groups`);
      const newGroupRef = push(groupsRef);

      const group = {
        ...groupData,
        createdAt: new Date().toISOString(),
      };

      await set(newGroupRef, group);
      return newGroupRef.key;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addPlayer = useCallback(async (auctionId, playerData) => {
    try {
      setLoading(true);
      setError(null);

      const playersRef = ref(db, `auctions/${auctionId}/players`);
      const newPlayerRef = push(playersRef);

      const player = {
        ...playerData,
        createdAt: new Date().toISOString(),
      };

      await set(newPlayerRef, player);
      return newPlayerRef.key;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePlayer = useCallback(async (auctionId, playerId) => {
    try {
      setLoading(true);
      setError(null);

      const playerRef = ref(db, `auctions/${auctionId}/players/${playerId}`);
      await remove(playerRef);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlayer = useCallback(async (auctionId, playerId, playerData) => {
    try {
      setLoading(true);
      setError(null);

      const playerRef = ref(db, `auctions/${auctionId}/players/${playerId}`);
      await update(playerRef, playerData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAuction = useCallback(async (auctionId, updates) => {
    try {
      setLoading(true);
      setError(null);

      const auctionRef = ref(db, `auctions/${auctionId}`);
      await update(auctionRef, updates);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTeamBudget = useCallback(async (auctionId, teamId, newBudget) => {
    try {
      setLoading(true);
      setError(null);

      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      await update(teamRef, {
        budget_remaining: newBudget,
      });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addPlayerToTeam = useCallback(
    async (auctionId, teamId, playerId, soldPrice) => {
      try {
        setLoading(true);
        setError(null);

        // Add player to team squad
        const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
        const teamSnapshot = await get(teamRef);
        const team = teamSnapshot.val();

        const updatedSquad = [...(team.squad || []), playerId];
        const newBudgetRemaining =
          Number(team.budget_remaining || 0) - Number(soldPrice);

        await update(teamRef, {
          squad: updatedSquad,
          budget_remaining: newBudgetRemaining,
        });

        // Mark player as sold
        const playerRef = ref(db, `auctions/${auctionId}/players/${playerId}`);
        await update(playerRef, {
          soldTo: teamId,
          soldPrice: soldPrice,
        });
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteAuction = useCallback(async (auctionId) => {
    try {
      setLoading(true);
      setError(null);

      const auctionRef = ref(db, `auctions/${auctionId}`);
      await remove(auctionRef);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGroup = useCallback(async (auctionId, groupId, groupData) => {
    try {
      setLoading(true);
      setError(null);

      const groupRef = ref(db, `auctions/${auctionId}/groups/${groupId}`);
      await update(groupRef, groupData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteGroup = useCallback(async (auctionId, groupId) => {
    try {
      setLoading(true);
      setError(null);

      const groupRef = ref(db, `auctions/${auctionId}/groups/${groupId}`);
      await remove(groupRef);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTeam = useCallback(async (auctionId, teamId, teamData) => {
    try {
      setLoading(true);
      setError(null);

      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      await update(teamRef, teamData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTeam = useCallback(async (auctionId, teamId) => {
    try {
      setLoading(true);
      setError(null);

      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      await remove(teamRef);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    auctions,
    loading,
    error,
    createAuction,
    addTeam,
    addGroup,
    addPlayer,
    deletePlayer,
    updatePlayer,
    updateAuction,
    updateTeamBudget,
    addPlayerToTeam,
    deleteAuction,
    updateGroup,
    deleteGroup,
    updateTeam,
    deleteTeam,
  };
};
