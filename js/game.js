// js/game.js

import { MAP_SIZE, FORT_X, FORT_Y, VICTORY_CLEARED_BLOCKS, RESEARCH_PROJECTS, FACTIONS, ACHIEVEMENTS } from './data.js';
import { createGroupLeader, createRandomSurvivor } from './utils.js';
import { updateUI, logMessage, showStatInfo, showSurvivorDetailsInLog } from './uiUpdates.js';
import { openDb, saveGameStateToDb, loadGameStateFromDb } from './persistence.js';
import { showChangelogModal, hideChangelogModal, showEventChoiceModal, showTradeModal, openEquipItemModal, showBlockActionSurvivorModal, hideBlockActionSurvivorModal, showWarningModal, hideWarningModal, showSurvivorModal, hideSurvivorModal, showInventoryModal, hideInventoryModal, showResearchModal, hideResearchModal, showAchievementsModal, hideAchievementsModal, selectedActionInModal, selectedSurvivorInModal, currentBlockInModal, equipModalSelectedSurvivor, updatePerformButtonState, handleEquipItem } from './modals.js';
import { performAction, completeTask, recruitSurvivor, researchProject, advisoryConsult, nextDay } from './gameLogic.js';

// Initial game state with new V5 properties
export function getInitialGameState() {
    const initialSurvivors = [];
    // Add one group leader
    initialSurvivors.push(createGroupLeader(1));
    // Add remaining random survivors
    for (let i = 0; i < 4; i++) { // 5 total, so 4 more
        initialSurvivors.push(createRandomSurvivor(1));
    }

    return {
        day: 1,
        survivors: initialSurvivors,
        maxSurvivors: 5,
        food: 50,
        materials: 30,
        researchPoints: 0,
        fortDefense: 10,
        foodProduction: 0,
        materialProduction: 0,
        morale: 75, // Overall morale, though individual is tracked
        inventory: [],
        map: [],
        selectedBlock: null, // Used for map highlighting only
        selectedSurvivorId: null, // Used for survivor list highlighting only
        research: JSON.parse(JSON.stringify(RESEARCH_PROJECTS)),
        factions: JSON.parse(JSON.stringify(FACTIONS)),
        messageHistory: [], // New: Store all messages for filtering
        totalSurvivorsRecruited: 5, // Start with initial survivors
        totalBlocksCleared: 0,
        achievements: JSON.parse(JSON.stringify(ACHIEVEMENTS)), // Deep copy of achievements
        // New warning tracking for the day
        lastFoodWarningDay: 0,
        lastMaterialsWarningDay: 0,
        lastZombieAttackWarningDay: 0,
        lastSurvivorDeathWarningDay: 0,
        lastSurvivorInjuryWarningDay: 0,
        lastAdvisoryDay: 0 // New: Track last day advisory was used
    };
}

export let gameState = getInitialGameState(); // This must be after getInitialGameState is defined.

// Fast Forward variables
export let fastForwardInterval = null;

// --- Game Initialization ---
export function initializeGame() {
    // Re-initialize gameState here to ensure a fresh start if no save is found
    gameState = getInitialGameState();
    gameState.map = [];
    for (let y = 0; y < MAP_SIZE; y++) {
        gameState.map[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            gameState.map[y][x] = {
                type: 'ruined',
                zombies: Math.floor(Math.random() * 5) + 1,
                resources: Math.floor(Math.random() * 10) + 5,
                x, y,
                hasHousing: false, hasWorkshop: false, hasLab: false, hasWatchtower: false, hasScoutPost: false,
                factionControlledBy: null,
                isVisible: false, // V7.0: Initially hidden
                isExplored: false // V7.0: Initially unexplored
            };
        }
    }

    // Set Fort block
    const fortBlock = gameState.map[FORT_Y][FORT_X];
    fortBlock.type = 'fort';
    fortBlock.zombies = 0; // No zombies at fort
    fortBlock.resources = 0; // No resources at fort
    fortBlock.isVisible = true;
    fortBlock.isExplored = true;

    // Initially explore blocks adjacent to the fort
    updateInfluenceZone(gameState); // This will mark initial blocks as explored/visible

    gameState.selectedBlock = null;
    gameState.selectedSurvivorId = null;
    updateUI(gameState);
    logMessage("Welcome to Resurgent City v8.0! Reclaim the city from the zombies. 🏙️", 'log-generic');
    logMessage("Click a map block to assign a task. Use 'Expedition' to explore new areas! 🗺️", 'log-generic');
    checkAchievements(gameState); // Check achievements on new game start
}

// --- Achievement Functions ---
export function checkAchievements(gameState) {
    for (const key in gameState.achievements) {
        const achievement = gameState.achievements[key];
        if (!achievement.unlocked) {
            let achieved = false;
            switch (key) {
                case "first_clear":
                case "city_reclaimer":
                    achieved = gameState.totalBlocksCleared >= achievement.target;
                    break;
                case "recruiter":
                    achieved = gameState.totalSurvivorsRecruited >= achievement.target;
                    break;
                case "fort_defender":
                    achieved = gameState.fortDefense >= achievement.target;
                    break;
                case "master_researcher":
                    achieved = Object.values(gameState.research).filter(p => p.researched).length >= achievement.target;
                    break;
            }

            if (achieved) {
                achievement.unlocked = true;
                logMessage(`ACHIEVEMENT UNLOCKED: "${achievement.name}"! ${achievement.description} 🏆`, 'log-victory');
                showWarningModal("Achievement Unlocked!", `You earned: "${achievement.name}"\n\n${achievement.description}`);
            }
        }
    }
}

export function checkVictoryCondition(gameState) {
    let clearedCount = 0;
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (gameState.map[y][x].type === 'cleared') {
                clearedCount++;
            }
        }
    }

    const disableAllGameButtons = () => {
        // Access buttons from global window.game object
        window.game.btnNextDay.disabled = true;
        window.game.btnRecruitSurvivor.disabled = true;
        window.game.btnEquipItem.disabled = true;
        window.game.btnAdvisory.disabled = true;
        window.game.btnFastForward.disabled = true;
        window.game.btnStopFastForward.disabled = true;
        stopFastForward(); // Ensure fast forward stops
    };

    if (clearedCount >= VICTORY_CLEARED_BLOCKS) {
        logMessage(`VICTORY! You have cleared ${clearedCount} blocks! The city is safe... for now. 🎉`, 'log-victory');
        disableAllGameButtons();
    } else if (gameState.survivors.length <= 0) {
        logMessage("DEFEAT! All your survivors are gone. The city falls to the undead. 💀 Game Over.", 'log-defeat');
        disableAllGameButtons();
    }
}

// --- Persistence Functions ---
export async function saveGame() {
    await saveGameStateToDb(gameState);
}

export async function loadGame() {
    await loadGameStateFromDb(gameState, setGameState, initializeGame);
}

// --- Fast Forward Functions ---
export function startFastForward() {
    if (fastForwardInterval) return; // Already running
    logMessage("Fast Forward enabled! Days will progress automatically. ⏩", 'log-generic');
    fastForwardInterval = setInterval(() => {
        nextDay(gameState, updateUI, stopFastForward, showWarningModal, completeTask, checkAchievements, showEventChoiceModal, window.game.getSurvivorSkill, window.game.getSurvivorDefense, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS, window.game.MAX_FORT_DEFENSE);
        // Stop fast forward if game is over
        if (gameState.survivors.length <= 0 || gameState.map.flat().filter(b => b.type === 'cleared').length >= VICTORY_CLEARED_BLOCKS) {
            stopFastForward();
        }
    }, 2000); // Progress every 2 seconds
    window.game.btnFastForward.disabled = true;
    window.game.btnStopFastForward.disabled = false;
}

export function stopFastForward() {
    if (fastForwardInterval) {
        clearInterval(fastForwardInterval);
        fastForwardInterval = null;
        logMessage("Fast Forward stopped. ⏹️", 'log-generic');
    }
    window.game.btnFastForward.disabled = false;
    window.game.btnStopFastForward.disabled = true;
}

// Function to update gameState (used by loadGame)
export function setGameState(newState) {
    gameState = newState;
}

// Export functions that need to be accessed globally or by other modules
// This creates a global 'game' object to hold these for event listeners in main.js
// and for random events in data.js
window.game = window.game || {};
Object.assign(window.game, {
    gameState,
    initializeGame,
    saveGame,
    loadGame,
    startFastForward,
    stopFastForward,
    checkAchievements,
    checkVictoryCondition,
    performAction: (actionType, selectedSurvivor, block) => performAction(actionType, selectedSurvivor, block, gameState),
    completeTask: (survivor) => completeTask(survivor, gameState),
    recruitSurvivor: () => recruitSurvivor(gameState, updateUI, checkAchievements, createRandomSurvivor),
    researchProject: (key) => researchProject(key, gameState, updateUI, checkAchievements),
    advisoryConsult: () => advisoryConsult(gameState, updateUI, showEventChoiceModal, window.game.getSurvivorSkill, window.game.getSurvivorDefense),
    nextDay: () => nextDay(gameState, updateUI, stopFastForward, showWarningModal, completeTask, checkAchievements, showEventChoiceModal, window.game.getSurvivorSkill, window.game.getSurvivorDefense, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS, window.game.MAX_FORT_DEFENSE),
    selectBlock: (x, y) => {
        gameState.selectedBlock = { x, y }; // Update selectedBlock in gameState
        showBlockActionSurvivorModal(gameState.map[y][x], gameState, window.game.getAvailableActionsForBlock, showSurvivorDetailsInLog);
        updateUI(gameState);
    },
    showStatInfo: (statId) => showStatInfo(statId, gameState),
    showSurvivorDetailsInLog,
    showChangelogModal,
    hideChangelogModal,
    showWarningModal,
    hideWarningModal,
    showSurvivorModal: () => showSurvivorModal(gameState, showSurvivorDetailsInLog),
    hideSurvivorModal,
    showInventoryModal: () => showInventoryModal(gameState),
    hideInventoryModal,
    showResearchModal: () => showResearchModal(gameState),
    hideResearchModal,
    showAchievementsModal: () => showAchievementsModal(gameState),
    hideAchievementsModal,
    openEquipItemModal: () => openEquipItemModal(gameState, updateUI, handleEquipItem),
    handleEquipItem: (targetSurvivor, itemIndex) => handleEquipItem(targetSurvivor, itemIndex, gameState, hideGenericModal, equipItemModal, updateUI),
    performTaskFromModal: () => performTaskFromModal(gameState, window.game.performAction, hideBlockActionSurvivorModal, updateUI),
    hideBlockActionSurvivorModal: () => hideBlockActionSurvivorModal(gameState, updateUI),
    getAvailableActionsForBlock: (block) => window.game.getAvailableActionsForBlock(block, gameState),
    getSurvivorSkill: (survivor, skillType) => window.game.getSurvivorSkill(survivor, skillType),
    getSurvivorDefense: (survivor) => window.game.getSurvivorDefense(survivor),
    randomEvents: window.game.randomEvents, // Re-export randomEvents from data.js via main.js
    updateInfluenceZone: (state) => window.game.updateInfluenceZone(state),
    isInInfluenceZone: (x, y, state) => window.game.isInInfluenceZone(x, y, state, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS),
    isAdjacentToExplored: (x, y, state) => window.game.isAdjacentToExplored(x, y, state, MAP_SIZE),
    getThreatBlocksInInfluenceZone: (state) => window.game.getThreatBlocksInInfluenceZone(state, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS),
    handleTrade: (traderSurvivor, type, amount, cost) => window.game.handleTrade(traderSurvivor, type, amount, cost, gameState, hideGenericModal, window.game.tradeModal, window.game.tradeYourFood, window.game.tradeYourMaterials, window.game.tradeBuyMaterialsBtn, window.game.tradeBuyMaterialsLargeBtn, window.game.tradeBuyFoodBtn, window.game.tradeBuyFoodLargeBtn),
    // Exporting modal state variables for access in main.js event listeners
    selectedActionInModal,
    selectedSurvivorInModal,
    currentBlockInModal,
    equipModalSelectedSurvivor,
    updatePerformButtonState,
    // Exporting modal DOM elements for direct access in main.js event listeners
    eventChoiceModal: null, // Will be set by main.js
    tradeModal: null,
    equipItemModal: null,
    blockActionSurvivorModal: null,
    warningModal: null,
    changelogModal: null,
    survivorModal: null,
    inventoryModal: null,
    researchModal: null,
    achievementsModal: null,
    // Add references to buttons that need to be disabled/enabled
    btnNextDay: null,
    btnRecruitSurvivor: null,
    btnEquipItem: null,
    btnAdvisory: null,
    btnFastForward: null,
    btnStopFastForward: null,
    tradeYourFood: null,
    tradeYourMaterials: null,
    tradeBuyMaterialsBtn: null,
    tradeBuyMaterialsLargeBtn: null,
    tradeBuyFoodBtn: null,
    tradeBuyFoodLargeBtn: null,
    tradeModal: null,
    nomadReputationDisplay: null,
    closeTradeModalBtn: null,
    equipModalTitle: null,
    equipModalInstruction: null,
    equipItemList: null,
    closeEquipModalBtn: null,
    blockActionModalTitle: null,
    blockActionModalDetails: null,
    blockActionModalActions: null,
    blockActionModalAssignedSurvivors: null,
    blockActionModalAvailableSurvivors: null,
    blockActionModalPerformBtn: null,
    blockActionModalCancelBtn: null,
    warningModalTitle: null,
    warningModalText: null,
    closeWarningModalBtn: null,
    survivorModalList: null,
    closeSurvivorModalBtn: null,
    inventoryModalList: null,
    closeInventoryModalBtn: null,
    researchModalPoints: null,
    researchModalList: null,
    closeResearchModalBtn: null,
    achievementsModalList: null,
    closeAchievementsModalBtn: null,
    eventChoiceTitle: null,
    eventChoiceText: null,
    eventChoiceButtons: null,
    logFilterElement: null,
    messageLogElement: null,
    mapElement: null,
    statDaySpan: null,
    statSurvivorsCountSpan: null,
    statMaxSurvivorsSpan: null,
    statFoodSpan: null,
    statMaterialsSpan: null,
    statResearchPointsSpan: null,
    statFortDefenseSpan: null,
    statFoodProductionSpan: null,
    statMaterialsProductionSpan: null,
    statMoraleSpan: null,
    statShelterQualitySpan: null,
    statMedicalCareSpan: null
});
