import { useState, useCallback } from "react";
import { ref, set, push, get, update, remove } from "firebase/database";
import { db } from "../utils/firebaseConfig";

/**
 * Hook for managing auction templates - save, load, list, update, delete
 * Templates store reusable configurations for groups, teams, and auction settings
 */
export const useAuctionTemplate = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Save current auction configuration as a reusable template
   * @param {string} templateName - Name for the template
   * @param {string} description - Optional description
   * @param {object} auctionSettings - Auction settings (purse_size, max_players, etc.)
   * @param {array} teams - Array of team objects
   * @param {array} groups - Array of group objects
   * @returns {string} - The new template ID
   */
  const saveTemplate = useCallback(
    async (templateName, description, auctionSettings, teams, groups) => {
      try {
        setLoading(true);
        setError(null);

        const templatesRef = ref(db, "auction_templates");
        const newTemplateRef = push(templatesRef);

        // Clean team data for template (remove runtime fields)
        const teamTemplate = teams.map((team) => ({
          team_name: team.team_name || team.teamName || "",
          owner_name: team.owner_name || team.ownerName || "",
          budget_total: Number(team.budget_total || team.budgetTotal || 0),
          team_logo: team.team_logo || team.teamLogo || "",
          // Don't save pins in templates - they should be set per auction
        }));

        // Clean group data for template
        const groupTemplate = groups.map((group, index) => ({
          group_name: group.group_name || group.groupName || "",
          base_price: Number(group.base_price || group.basePrice || 0),
          increment_value: Number(
            group.increment_value || group.incrementValue || 0,
          ),
          max_bid_cap: group.max_bid_cap || group.maxBidCap || null,
          min_per_team: Number(group.min_per_team || group.minPerTeam || 0),
          max_per_team: Number(group.max_per_team || group.maxPerTeam || 0),
          order: group.order ?? index + 1,
        }));

        const template = {
          template_name: templateName,
          description: description || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),

          auction_settings: {
            purse_size: Number(auctionSettings.purse_size || 0),
            total_players: Number(auctionSettings.total_players || 0),
            max_players_per_team: Number(
              auctionSettings.max_players_per_team || 0,
            ),
            auction_mode: auctionSettings.auction_mode || "open_after_aplus",
          },

          team_template: teamTemplate,
          group_template: groupTemplate,
        };

        await set(newTemplateRef, template);
        return newTemplateRef.key;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Load a template by ID
   * @param {string} templateId - The template ID to load
   * @returns {object} - The template data
   */
  const loadTemplate = useCallback(async (templateId) => {
    try {
      setLoading(true);
      setError(null);

      const templateRef = ref(db, `auction_templates/${templateId}`);
      const snapshot = await get(templateRef);

      if (!snapshot.exists()) {
        throw new Error("Template not found");
      }

      return { id: templateId, ...snapshot.val() };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * List all available templates
   * @returns {array} - Array of template objects with IDs
   */
  const listTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const templatesRef = ref(db, "auction_templates");
      const snapshot = await get(templatesRef);

      if (!snapshot.exists()) {
        return [];
      }

      const templatesData = snapshot.val();
      return Object.entries(templatesData).map(([id, data]) => ({
        id,
        ...data,
      }));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing template
   * @param {string} templateId - The template ID to update
   * @param {object} templateData - The updated template data
   */
  const updateTemplate = useCallback(async (templateId, templateData) => {
    try {
      setLoading(true);
      setError(null);

      const templateRef = ref(db, `auction_templates/${templateId}`);

      const updates = {
        ...templateData,
        updatedAt: new Date().toISOString(),
      };

      await update(templateRef, updates);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a template
   * @param {string} templateId - The template ID to delete
   */
  const deleteTemplate = useCallback(async (templateId) => {
    try {
      setLoading(true);
      setError(null);

      const templateRef = ref(db, `auction_templates/${templateId}`);
      await remove(templateRef);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Apply a template to get auction form data
   * Converts template format to the format used by AdminSetup
   * @param {object} template - The loaded template
   * @returns {object} - { auctionData, teams, groups }
   */
  const applyTemplate = useCallback((template) => {
    const auctionData = {
      purseSize: Number(template.auction_settings?.purse_size || 0),
      maxPlayers: Number(template.auction_settings?.total_players || 0),
      maxPlayersPerTeam: Number(
        template.auction_settings?.max_players_per_team || 11,
      ),
      auctionMode:
        template.auction_settings?.auction_mode || "open_after_aplus",
    };

    const teams = (template.team_template || []).map((team, index) => ({
      id: `template_team_${index}`,
      team_name: team.team_name || team.teamName || "",
      owner_name: team.owner_name || team.ownerName || "",
      budget_total: Number(
        team.budget_total || team.budgetTotal || auctionData.purseSize || 0,
      ),
      team_logo: team.team_logo || team.teamLogo || "",
      pin: "",
    }));

    const groups = (template.group_template || []).map((group, index) => ({
      id: `template_group_${index}`,
      group_name: group.group_name || group.groupName || "",
      base_price: Number(group.base_price || group.basePrice || 0),
      increment_value: Number(group.increment_value || group.incrementValue || 0),
      max_bid_cap: group.max_bid_cap || group.maxBidCap || "",
      min_per_team: Number(group.min_per_team || group.minPerTeam || 0),
      max_per_team: Number(group.max_per_team || group.maxPerTeam || 0),
      order: Number(group.order || index + 1),
    }));

    return { auctionData, teams, groups };
  }, []);

  return {
    loading,
    error,
    saveTemplate,
    loadTemplate,
    listTemplates,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
  };
};
