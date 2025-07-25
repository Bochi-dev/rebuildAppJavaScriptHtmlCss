// js/persistence.js

import { DB_NAME, STORE_NAME, DB_VERSION, getInitialGameState, RESEARCH_PROJECTS, FACTIONS, EQUIPMENT } from './data.js';
import { logMessage, updateUI, checkVictoryCondition } from './uiUpdates.js'; // Import from uiUpdates
import { updateInfluenceZone } from './gameLogic.js'; // Import from gameLogic
import { createRandomSurvivor } from './utils.js'; // Import createRandomSurvivor for loading old saves

let db; // IndexedDB database instance

export function getDbInstance() {
    return db;
}

export function setDbInstance(instance) {
    db = instance;
}

export function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            // Add new fields to existing blocks if upgrading from older versions
            const store = event.target.transaction.objectStore(STORE_NAME);
            store.openCursor().onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    const oldState = cursor.value;
                    // Ensure map blocks have new properties
                    if (oldState.map) {
                        oldState.map = oldState.map.map(row => row.map(block => ({
                            ...block,
                            isVisible: block.isVisible !== undefined ? block.isVisible : true, // Default to true for old saves
                            isExplored: block.isExplored !== undefined ? block.isExplored : true, // Default to true for old saves
                            hasScoutPost: block.hasScoutPost !== undefined ? block.hasScoutPost : false
                        })));
                    }
                    // Ensure survivors have new properties if loading old save
                    if (oldState.survivors) {
                        oldState.survivors = oldState.survivors.map(survivor => ({
                            daysRemaining: 0, // V7.1: New field
                            assignedBlock: null, // V7.1: New field
                            ...survivor
                        }));
                    }
                    // Update the record
                    cursor.update(oldState);
                    cursor.continue();
                }
            };
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode, event.target.error);
            reject("IndexedDB error");
        };
    });
}

export async function saveGameStateToDb(gameState) {
    if (!db) {
        logMessage("Database not open. Attempting to open for saving.", 'log-danger');
        try {
            await openDb();
        } catch (e) {
            logMessage("Failed to open database for saving. ❌", 'log-danger');
            return;
        }
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const stateToSave = { ...gameState };
        const request = store.put(stateToSave, 'currentGameState');

        request.onsuccess = () => {
            logMessage("Game saved successfully! 💾", 'log-success');
            resolve();
        };

        request.onerror = (event) => {
            logMessage("Failed to save game. ❌", 'log-danger');
            console.error("Save error:", event.target.error);
            reject("Save error");
        };
    });
}

export async function loadGameStateFromDb(gameState, setGameState, initializeGame) {
    if (!db) {
        logMessage("Database not open. Attempting to open for loading.", 'log-danger');
        try {
            await openDb();
        } catch (e) {
            logMessage("Failed to open database for loading. Starting new game. ❌", 'log-danger');
            initializeGame();
            return;
        }
    }

    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('currentGameState');

        request.onsuccess = (event) => {
            const loadedState = event.target.result;
            if (loadedState) {
                // Deep merge to ensure new properties from V7.1 exist and old ones are preserved
                setGameState({
                    ...getInitialGameState(), // Start with a fresh initial state
                    ...loadedState,
                    // Ensure map blocks have default properties if missing from old saves
                    map: loadedState.map.map(row => row.map(block => ({
                        hasFarm: false, hasHousing: false, hasWorkshop: false, hasLab: false, hasWatchtower: false, hasScoutPost: false, // V7.0: new hasScoutPost
                        isVisible: block.isVisible !== undefined ? block.isVisible : true, // V7.0: new isVisible, default true for old saves
                        isExplored: block.isExplored !== undefined ? block.isExplored : true, // V7.0: new isExplored, default true for old saves
                        ...block
                    }))),
                    // Ensure survivors have new properties if loading old save
                    survivors: loadedState.survivors.map(survivor => ({
                        health: survivor.health !== undefined ? survivor.health : 100,
                        morale: survivor.morale !== undefined ? survivor.morale : 75,
                        isBusy: false, // Reset busy status on load
                        isSick: survivor.health !== undefined ? (survivor.health < 50) : false,
                        equippedItem: null, // Reset equipped item on load (will be re-equipped from inventory if logic allows)
                        trait: survivor.trait || createRandomSurvivor(1).trait, // Use createRandomSurvivor to get a random trait if missing
                        currentTask: null, // Reset current task on load
                        currentResearchBlock: null, // New: Reset research block
                        dayJoined: survivor.dayJoined !== undefined ? survivor.dayJoined : 1, // Default for old saves
                        daysRemaining: 0, // V7.1: New field
                        assignedBlock: null, // V7.1: New field
                        ...survivor
                    })),
                    // Ensure research projects are up-to-date
                    research: {
                        ...JSON.parse(JSON.stringify(RESEARCH_PROJECTS)),
                        ...loadedState.research
                    },
                    // Ensure factions are up-to-date and have reputation
                    factions: loadedState.factions.map(faction => ({
                        reputation: faction.reputation !== undefined ? faction.reputation : 50,
                        ...FACTIONS.find(f => f.id === faction.id),
                        ...faction
                    })),
                    // Ensure inventory is correctly loaded, mapping item IDs to full item objects
                    inventory: loadedState.inventory.map(item => EQUIPMENT[item.id] || item),
                    // Ensure messageHistory is loaded or initialized
                    messageHistory: loadedState.messageHistory || [],
                    // Ensure new achievement tracking stats are initialized if missing
                    totalSurvivorsRecruited: loadedState.totalSurvivorsRecruited !== undefined ? loadedState.totalSurvivorsRecruited : loadedState.survivors.length,
                    totalBlocksCleared: loadedState.totalBlocksCleared !== undefined ? loadedState.totalBlocksCleared : 0,
                    // Ensure achievements are up-to-date and unlocked status is preserved
                    achievements: Object.fromEntries(
                        Object.entries(getInitialGameState().achievements).map(([key, defaultAch]) => { // Use initial achievements for defaults
                            const loadedAch = loadedState.achievements ? loadedState.achievements[key] : null;
                            return [key, {
                                ...defaultAch,
                                unlocked: loadedAch ? loadedAch.unlocked : false,
                            }];
                        })
                    ),
                    // Ensure warning flags are reset/initialized for the current day
                    lastFoodWarningDay: 0,
                    lastMaterialsWarningDay: 0,
                    lastZombieAttackWarningDay: 0,
                    lastSurvivorDeathWarningDay: 0,
                    lastSurvivorInjuryWarningDay: 0,
                    lastAdvisoryDay: 0 // Reset advisory flag
                });
                logMessage("Game loaded successfully! ✅", 'log-success');
                updateInfluenceZone(gameState); // Recalculate influence zone after loading
                updateUI(gameState);
                checkVictoryCondition(gameState);
            } else {
                logMessage("No saved game found. Starting a new game. 🆕", 'log-generic');
                initializeGame();
            }
            resolve();
        };

        request.onerror = (event) => {
            logMessage("Failed to load game. Starting new game. ❌", 'log-danger');
            console.error("Load error:", event.target.error);
            initializeGame();
            resolve();
        };
    });
}
