// js/main.js

import { MAP_SIZE, FORT_X, FORT_Y, DB_NAME, STORE_NAME, DB_VERSION, randomEvents } from './data.js';
import { setUIDOMElements, updateUI, logMessage, showStatInfo } from './uiUpdates.js';
import { setModalDOMElements, showChangelogModal, hideChangelogModal, showEventChoiceModal, showTradeModal, openEquipItemModal, showBlockActionSurvivorModal, hideBlockActionSurvivorModal, showWarningModal, hideWarningModal, showSurvivorModal, hideSurvivorModal, showInventoryModal, hideInventoryModal, showResearchModal, hideResearchModal, showAchievementsModal, hideAchievementsModal, updatePerformButtonState, selectedActionInModal, selectedSurvivorInModal, currentBlockInModal, equipModalSelectedSurvivor } from './modals.js';
import { initializeGame, saveGame, loadGame, startFastForward, stopFastForward, recruitSurvivor, researchProject, advisoryConsult, nextDay, gameState as globalGameState, setGameState, checkAchievements, checkVictoryCondition } from './game.js';
import { getSurvivorSkill, getSurvivorDefense, calculateTaskDuration, isAdjacentToExplored, isInInfluenceZone, getThreatBlocksInInfluenceZone, createRandomSurvivor } from './utils.js';
import { getDbInstance, setDbInstance, openDb, saveGameStateToDb, loadGameStateFromDb } from './persistence.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Assign DOM elements to uiUpdates module
    setUIDOMElements({
        mapElement: document.getElementById('game-map'),
        statDaySpan: document.getElementById('stat-day'),
        statSurvivorsCountSpan: document.getElementById('stat-survivors-count'),
        statMaxSurvivorsSpan: document.getElementById('stat-max-survivors'),
        statFoodSpan: document.getElementById('stat-food'),
        statMaterialsSpan: document.getElementById('stat-materials'),
        statResearchPointsSpan: document.getElementById('stat-research-points'),
        statFortDefenseSpan: document.getElementById('stat-fort-defense'),
        statFoodProductionSpan: document.getElementById('stat-food-production'),
        statMaterialsProductionSpan: document.getElementById('stat-materials-production'),
        statMoraleSpan: document.getElementById('stat-morale'),
        statShelterQualitySpan: document.getElementById('stat-shelter-quality'),
        statMedicalCareSpan: document.getElementById('stat-medical-care')
    });

    // Assign DOM elements to modals module
    setModalDOMElements({
        eventChoiceModal: document.getElementById('event-choice-modal'),
        eventChoiceTitle: document.getElementById('event-choice-title'),
        eventChoiceText: document.getElementById('event-choice-text'),
        eventChoiceButtons: document.getElementById('event-choice-buttons'),

        tradeModal: document.getElementById('trade-modal'),
        tradeYourFood: document.getElementById('trade-your-food'),
        tradeYourMaterials: document.getElementById('trade-your-materials'),
        nomadReputationDisplay: document.getElementById('nomad-reputation'),
        tradeBuyMaterialsBtn: document.getElementById('trade-buy-materials'),
        tradeBuyMaterialsLargeBtn: document.getElementById('trade-buy-materials-large'),
        tradeBuyFoodBtn: document.getElementById('trade-buy-food'),
        tradeBuyFoodLargeBtn: document.getElementById('trade-buy-food-large'),
        closeTradeModalBtn: document.getElementById('close-trade-modal'),

        equipItemModal: document.getElementById('equip-item-modal'),
        equipModalTitle: document.getElementById('equip-modal-title'),
        equipModalInstruction: document.getElementById('equip-modal-instruction'),
        equipItemList: document.getElementById('equip-item-list'),
        closeEquipModalBtn: document.getElementById('close-equip-modal'),

        blockActionSurvivorModal: document.getElementById('block-action-survivor-modal'),
        blockActionModalTitle: document.getElementById('block-action-modal-title'),
        blockActionModalDetails: document.getElementById('block-action-modal-details'),
        blockActionModalActions: document.getElementById('block-action-modal-actions'),
        blockActionModalAssignedSurvivors: document.getElementById('block-action-modal-assigned-survivors'),
        blockActionModalAvailableSurvivors: document.getElementById('block-action-modal-available-survivors'),
        blockActionModalPerformBtn: document.getElementById('block-action-modal-perform'),
        blockActionModalCancelBtn: document.getElementById('block-action-modal-cancel'),

        warningModal: document.getElementById('warning-modal'),
        warningModalTitle: document.getElementById('warning-modal-title'),
        warningModalText: document.getElementById('warning-modal-text'),
        closeWarningModalBtn: document.getElementById('close-warning-modal'),

        changelogModal: document.getElementById('changelog-modal'),
        closeChangelogModal: document.getElementById('close-changelog-modal'),

        survivorModal: document.getElementById('survivor-modal'),
        survivorModalList: document.getElementById('survivor-modal-list'),
        closeSurvivorModalBtn: document.getElementById('close-survivor-modal'),

        inventoryModal: document.getElementById('inventory-modal'),
        inventoryModalList: document.getElementById('inventory-modal-list'),
        closeInventoryModalBtn: document.getElementById('close-inventory-modal'),

        researchModal: document.getElementById('research-modal'),
        researchModalPoints: document.getElementById('research-modal-points'),
        researchModalList: document.getElementById('research-modal-list'),
        closeResearchModalBtn: document.getElementById('close-research-modal'),

        achievementsModal: document.getElementById('achievements-modal'),
        achievementsModalList: document.getElementById('achievements-modal-list'),
        closeAchievementsModalBtn: document.getElementById('close-achievements-modal')
    });

    // Assign global game object properties for direct access by event listeners
    window.game.btnNextDay = document.getElementById('action-next-day');
    window.game.btnRecruitSurvivor = document.getElementById('action-recruit-survivor');
    window.game.btnEquipItem = document.getElementById('action-equip-item');
    window.game.btnAdvisory = document.getElementById('action-advisory');
    window.game.btnFastForward = document.getElementById('action-fast-forward');
    window.game.btnStopFastForward = document.getElementById('action-stop-fast-forward');
    window.game.logFilterElement = document.getElementById('log-filter');
    window.game.messageLogElement = document.getElementById('message-log');


    // Add event listeners
    window.game.btnRecruitSurvivor.addEventListener('click', window.game.recruitSurvivor);
    window.game.btnNextDay.addEventListener('click', window.game.nextDay);
    document.getElementById('save-game').addEventListener('click', window.game.saveGame);
    document.getElementById('load-game').addEventListener('click', window.game.loadGame);
    document.getElementById('view-changelog').addEventListener('click', window.game.showChangelogModal);
    window.game.closeChangelogModal.addEventListener('click', window.game.hideChangelogModal);
    window.game.logFilterElement.addEventListener('change', () => updateUI(globalGameState));

    // Fast Forward listeners
    window.game.btnFastForward.addEventListener('click', window.game.startFastForward);
    window.game.btnStopFastForward.addEventListener('click', window.game.stopFastForward);

    // Event listeners for the new block action modal
    window.game.blockActionModalPerformBtn.addEventListener('click', window.game.performTaskFromModal);
    window.game.blockActionModalCancelBtn.addEventListener('click', window.game.hideBlockActionSurvivorModal);

    // Event listener for the Equip Item button
    window.game.btnEquipItem.addEventListener('click', window.game.openEquipItemModal);
    window.game.closeEquipModalBtn.addEventListener('click', () => {
        // If a survivor was selected in the equip modal but no item was equipped, free them up.
        if (equipModalSelectedSurvivor && equipModalSelectedSurvivor.isBusy && equipModalSelectedSurvivor.currentTask === 'Equipping Item') {
            equipModalSelectedSurvivor.isBusy = false;
            equipModalSelectedSurvivor.currentTask = null;
            equipModalSelectedSurvivor.assignedBlock = null; // Clear assigned block
            equipModalSelectedSurvivor.daysRemaining = 0; // Clear days remaining
        }
        window.game.equipModalSelectedSurvivor = null; // Reset
        window.game.hideGenericModal(window.game.equipItemModal);
        updateUI(globalGameState);
    });

    // Event listener for the generic warning modal
    window.game.closeWarningModalBtn.addEventListener('click', window.game.hideWarningModal);

    // Advisory button listener
    window.game.btnAdvisory.addEventListener('click', window.game.advisoryConsult);

    // New Modal Button Listeners
    document.getElementById('open-survivor-modal').addEventListener('click', window.game.showSurvivorModal);
    window.game.closeSurvivorModalBtn.addEventListener('click', window.game.hideSurvivorModal);

    document.getElementById('open-inventory-modal').addEventListener('click', window.game.showInventoryModal);
    window.game.closeInventoryModalBtn.addEventListener('click', window.game.hideInventoryModal);

    document.getElementById('open-research-modal').addEventListener('click', window.game.showResearchModal);
    window.game.closeResearchModalBtn.addEventListener('click', window.game.hideResearchModal);

    document.getElementById('open-achievements-modal').addEventListener('click', window.game.showAchievementsModal);
    window.game.closeAchievementsModalBtn.addEventListener('click', window.game.hideAchievementsModal);

    // Add event listeners for clickable stats
    document.querySelectorAll('.game-stats-item').forEach(item => {
        item.addEventListener('click', (event) => {
            const statId = event.currentTarget.dataset.statId;
            window.game.showStatInfo(statId);
        });
    });

    // Initialize IndexedDB and load game
    try {
        const dbInstance = await openDb();
        setDbInstance(dbInstance); // Set the db instance in persistence.js
        await loadGame();
    } catch (e) {
        logMessage("Failed to initialize database. Starting new game. ❌", 'log-danger');
        initializeGame();
    }
});

// Re-export randomEvents from data.js so it's accessible via window.game.randomEvents
window.game.randomEvents = randomEvents;

// Re-export utility functions to be accessible via window.game
window.game.getSurvivorSkill = getSurvivorSkill;
window.game.getSurvivorDefense = getSurvivorDefense;
window.game.calculateTaskDuration = calculateTaskDuration;
window.game.isAdjacentToExplored = isAdjacentToExplored;
window.game.isInInfluenceZone = isInInfluenceZone;
window.game.getThreatBlocksInInfluenceZone = getThreatBlocksInInfluenceZone;
window.game.createRandomSurvivor = createRandomSurvivor;
window.game.handleTrade = (traderSurvivor, type, amount, cost, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn) => {
    // This is a re-export of the function from uiUpdates.js, ensure it gets the correct parameters
    window.game.handleTradeInternal(traderSurvivor, type, amount, cost, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn);
};
window.game.handleTradeInternal = window.game.handleTrade; // Store the original reference
window.game.getAvailableActionsForBlock = (block, gameState) => {
    return window.game.getAvailableActionsForBlockInternal(block, gameState);
};
window.game.getAvailableActionsForBlockInternal = window.game.getAvailableActionsForBlock; // Store the original reference
window.game.updateInfluenceZone = (gameState) => {
    window.game.updateInfluenceZoneInternal(gameState);
};
window.game.updateInfluenceZoneInternal = window.game.updateInfluenceZone; // Store the original reference
