// js/gameLogic.js

import { MAP_SIZE, FORT_X, FORT_Y, MAX_FORT_DEFENSE, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS, EQUIPMENT, VICTORY_CLEARED_BLOCKS } from './data.js';
import { getSurvivorSkill, getSurvivorDefense, calculateTaskDuration, isAdjacentToExplored, isInInfluenceZone, getThreatBlocksInInfluenceZone, createRandomSurvivor } from './utils.js';
import { logMessage, updateUI, showWarningModal, showEventChoiceModal } from './uiUpdates.js';
import { selectedActionInModal, selectedSurvivorInModal, currentBlockInModal, hideBlockActionSurvivorModal, showTradeModal, equipModalSelectedSurvivor, hideGenericModal, equipItemModal } from './modals.js';
import { checkAchievements } from './game.js'; // Import checkAchievements from game.js

// `performAction` now initiates the task and sets duration
export function performAction(actionType, selectedSurvivor, block, gameState) {
    if (!selectedSurvivor || selectedSurvivor.isBusy || selectedSurvivor.isSick) {
        logMessage("Survivor is busy or sick and cannot perform this action. 😔", 'log-generic');
        return false;
    }

    // Special handling for instant actions (Trade, Assign to Research)
    if (actionType === 'trade') {
        // Trade logic is handled directly by showTradeModal and handleTrade
        // This function just acts as a trigger to open the modal
        const nomadFaction = gameState.factions.find(f => f.id === 'nomads');
        if (block.type === 'ruined' && block.isExplored && block.factionControlledBy === 'nomads' && isInInfluenceZone(block.x, block.y, gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS)) {
            selectedSurvivor.isBusy = true; // Mark busy immediately for trade
            selectedSurvivor.currentTask = 'Trading';
            selectedSurvivor.assignedBlock = { x: block.x, y: block.y };
            selectedSurvivor.daysRemaining = 0; // Instant action
            showTradeModal(selectedSurvivor, gameState);
            return true;
        } else {
            logMessage("Cannot trade here. Requires an explored Nomad-controlled block within your influence zone. 🚫", 'log-generic');
            return false;
        }
    } else if (actionType === 'assignToResearch') {
        if (block.type === 'cleared' && block.isExplored && block.hasLab) {
            const existingResearcher = gameState.survivors.find(s => s.currentResearchBlock && s.currentResearchBlock.x === block.x && s.currentResearchBlock.y === block.y);
            if (existingResearcher) {
                logMessage(`Another survivor, ${existingResearcher.name}, is already assigned to this Laboratory. 🚫`, 'log-generic');
                return false;
            }
            selectedSurvivor.isBusy = true;
            selectedSurvivor.currentTask = 'Research';
            selectedSurvivor.currentResearchBlock = { x: block.x, y: block.y };
            selectedSurvivor.assignedBlock = { x: block.x, y: block.y }; // Also set assignedBlock for map icon
            selectedSurvivor.daysRemaining = 0; // Continuous task, not turn-based completion
            logMessage(`${selectedSurvivor.name} is now working at the Laboratory at [${block.x},${block.y}] to generate Research Points. 🧪`, 'log-action');
            return true;
        } else {
            logMessage("Cannot assign to research. Requires an explored Laboratory block and an available survivor. 🚫", 'log-generic');
            return false;
        }
    }

    // For all other tasks, calculate duration and set survivor busy
    const duration = calculateTaskDuration(actionType, block.x, block.y, FORT_X, FORT_Y);
    let actionCostMet = true; // Assume cost met until checked

    // Check costs before initiating task
    switch (actionType) {
        case 'expedition':
            const EXPEDITION_FOOD_COST = 5;
            const EXPEDITION_MATERIALS_COST = 5;
            if (gameState.food < EXPEDITION_FOOD_COST || gameState.materials < EXPEDITION_MATERIALS_COST) {
                logMessage(`Expedition requires ${EXPEDITION_FOOD_COST} food and ${EXPEDITION_MATERIALS_COST} materials.`, 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildRepair':
            if (gameState.materials < 10) {
                logMessage("Repairing fort requires 10 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildHousing':
            if (gameState.materials < 20) {
                logMessage("Building Housing requires 20 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildWorkshop':
            if (gameState.materials < 15) {
                logMessage("Building Workshop requires 15 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildLab':
            if (gameState.materials < 25) {
                logMessage("Building Laboratory requires 25 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildWatchtower':
            if (gameState.materials < 20) {
                logMessage("Building Watchtower requires 20 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        case 'buildScoutPost':
            if (gameState.materials < 30) {
                logMessage("Building Scout Post requires 30 materials.", 'log-generic');
                actionCostMet = false;
            }
            break;
        // Scavenge, Clear, AttackFaction have no upfront material/food costs
    }

    if (!actionCostMet) {
        return false; // Cannot initiate task due to cost
    }

    // Check if trait causes failure (Clumsy trait) - applies at start of task
    if (selectedSurvivor.trait.name === "Clumsy 😬" && Math.random() < selectedSurvivor.trait.effect.failChance) {
        logMessage(`${selectedSurvivor.name} was clumsy and failed to start the task! 🤦‍♀️`, 'log-event');
        // Don't set busy or consume resources if they fail to even start
        return false;
    }

    // Deduct costs upon initiation for tasks with duration
    switch (actionType) {
        case 'expedition':
            gameState.food -= 5;
            gameState.materials -= 5;
            break;
        case 'buildRepair':
            gameState.materials -= 10;
            break;
        case 'buildHousing':
            gameState.materials -= 20;
            break;
        case 'buildWorkshop':
            gameState.materials -= 15;
            break;
        case 'buildLab':
            gameState.materials -= 25;
            break;
        case 'buildWatchtower':
            gameState.materials -= 20;
            break;
        case 'buildScoutPost':
            gameState.materials -= 30;
            break;
    }

    selectedSurvivor.isBusy = true;
    selectedSurvivor.currentTask = actionType;
    selectedSurvivor.assignedBlock = { x: block.x, y: block.y };
    selectedSurvivor.daysRemaining = duration;
    logMessage(`${selectedSurvivor.name} assigned to ${actionType} at [${block.x},${block.y}]. Will take ${duration} day(s). ⏳`, 'log-action');

    gameState.selectedSurvivorId = null; // Clear UI selection
    gameState.selectedBlock = null; // Clear UI selection
    updateUI(gameState);
    return true;
}

// V7.1: New function to complete a task and apply its effects
export function completeTask(survivor, gameState) {
    const block = gameState.map[survivor.assignedBlock.y][survivor.assignedBlock.x];
    let outcomeMessage = "";
    let outcomeType = 'log-action';

    switch (survivor.currentTask) {
        case 'expedition':
            // Re-check success chance at completion
            const successChance = 0.7 + (getSurvivorSkill(survivor, 'scavenging') * 0.05);
            if (Math.random() < successChance) {
                block.isExplored = true;
                block.isVisible = true;
                outcomeMessage = `${survivor.name} successfully explored block [${block.x},${block.y}]! Its secrets are revealed. 🗺️`;
                outcomeType = 'log-success';
                if (Math.random() < 0.3) {
                    const bonusFood = Math.floor(Math.random() * 3);
                    const bonusMaterials = Math.floor(Math.random() * 2);
                    gameState.food += bonusFood;
                    gameState.materials += bonusMaterials;
                    outcomeMessage += ` Found ${bonusFood} food and ${bonusMaterials} materials!`;
                    outcomeType = 'log-resource';
                }
                if (Math.random() < 0.15) {
                    const newZombies = Math.floor(Math.random() * 3) + 1;
                    block.zombies += newZombies;
                    outcomeMessage += ` Encountered ${newZombies} new zombies!`;
                    outcomeType = 'log-danger';
                }
                updateInfluenceZone(gameState);
            } else {
                outcomeMessage = `${survivor.name}'s expedition to [${block.x},${block.y}] failed! They encountered unexpected dangers. 🤕`;
                outcomeType = 'log-danger';
                survivor.health = Math.max(0, survivor.health - 15);
                if (survivor.health < 50) survivor.isSick = true;
            }
            break;
        case 'scavenge':
            const skill = getSurvivorSkill(survivor, 'scavenging');
            const researchBonus = gameState.research.improved_tools.researched ? gameState.research.improved_tools.effect.scavengingBonus : 0;
            const effectiveSkill = skill + researchBonus;

            const foodFound = Math.floor(Math.random() * 5) + 3 + effectiveSkill;
            const materialsFound = Math.floor(Math.random() * 3) + 1 + effectiveSkill;

            gameState.food += foodFound;
            gameState.materials += materialsFound;
            survivor.scavengingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} scavenged ${foodFound} food 🍎 and ${materialsFound} materials 🧱 from [${block.x},${block.y}]. Scavenging skill increased!`;
            outcomeType = 'log-resource';

            if (Math.random() < 0.15) {
                const itemKeys = Object.keys(EQUIPMENT);
                const randomItemKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
                const foundItem = EQUIPMENT[randomItemKey];
                gameState.inventory.push(foundItem);
                outcomeMessage += ` Found a ${foundItem.name}!`;
                outcomeType = 'log-success';
            }
            break;
        case 'clear':
            const clearSkill = getSurvivorSkill(survivor, 'clearing');
            const zombiesToClear = Math.min(block.zombies, Math.floor(Math.random() * 3) + 1 + clearSkill);
            block.zombies -= zombiesToClear;
            survivor.clearingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);

            if (block.zombies <= 0) {
                block.type = 'cleared';
                block.zombies = 0;
                outcomeMessage = `${survivor.name} cleared block [${block.x},${block.y}] of zombies! 🎉 Clearing skill increased!`;
                outcomeType = 'log-success';
                gameState.totalBlocksCleared++;
            } else {
                outcomeMessage = `${survivor.name} reduced zombies by ${zombiesToClear} in [${block.x},${block.y}]. 🧟 Clearing skill increased!`;
            }
            break;
        case 'buildRepair':
            const buildSkill = getSurvivorSkill(survivor, 'building');
            const researchBuildBonus = gameState.research.improved_tools.researched ? gameState.research.improved_tools.effect.buildingBonus : 0;
            const effectiveBuildSkill = buildSkill + researchBuildBonus;
            const fortBlock = gameState.map[FORT_Y][FORT_X];

            if (!fortBlock.hasFarm) {
                gameState.foodProduction += (5 + effectiveBuildSkill);
                fortBlock.hasFarm = true;
                outcomeMessage = `${survivor.name} built a basic farm at the fort! 🌾 +${5 + effectiveBuildSkill} Food Production daily. Building skill increased!`;
            } else {
                gameState.fortDefense = Math.min(MAX_FORT_DEFENSE, gameState.fortDefense + (5 + effectiveBuildSkill));
                outcomeMessage = `${survivor.name} repaired fort defenses! 🛡️ +${5 + effectiveBuildSkill} Fort Defense. Building skill increased!`;
            }
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeType = 'log-action';
            break;
        case 'buildHousing':
            const HOUSING_INCREASE = 5;
            gameState.maxSurvivors += HOUSING_INCREASE;
            block.hasHousing = true;
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} built Housing at [${block.x},${block.y}]! 🏠 Max survivors increased by ${HOUSING_INCREASE}. Building skill increased!`;
            outcomeType = 'log-action';
            break;
        case 'buildWorkshop':
            const WORKSHOP_PRODUCTION = 3;
            gameState.materialProduction += WORKSHOP_PRODUCTION;
            block.hasWorkshop = true;
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} built a Workshop at [${block.x},${block.y}]! ⚙️ +${WORKSHOP_PRODUCTION} Materials Production daily. Building skill increased!`;
            outcomeType = 'log-action';
            break;
        case 'buildLab':
            block.hasLab = true;
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} built a Laboratory at [${block.x},${block.y}]! 🧪 Assign a survivor to it to generate Research Points. Building skill increased!`;
            outcomeType = 'log-action';
            break;
        case 'buildWatchtower':
            const WATCHTOWER_DEFENSE = 5;
            gameState.fortDefense = Math.min(MAX_FORT_DEFENSE, gameState.fortDefense + WATCHTOWER_DEFENSE);
            block.hasWatchtower = true;
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} built a Watchtower at [${block.x},${block.y}]! 🗼 +${WATCHTOWER_DEFENSE} Fort Defense. Building skill increased!`;
            outcomeType = 'log-action';
            break;
        case 'buildScoutPost':
            block.hasScoutPost = true;
            survivor.buildingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            outcomeMessage = `${survivor.name} built a Scout Post at [${block.x},${block.y}]! 🔭 Your influence zone has expanded. Building skill increased!`;
            outcomeType = 'log-action';
            updateInfluenceZone(gameState);
            break;
        case 'attackFaction':
            const marauderFaction = gameState.factions.find(f => f.id === 'marauders');
            const survivorCombatSkill = getSurvivorSkill(survivor, 'clearing') + getSurvivorDefense(survivor);
            const attackSuccessChance = 0.5 + (survivorCombatSkill * 0.05) - (marauderFaction.reputation * 0.005);

            if (Math.random() < attackSuccessChance) {
                const clearedZombies = Math.min(block.zombies, Math.floor(Math.random() * 5) + 2);
                block.zombies -= clearedZombies;
                marauderFaction.reputation = Math.max(0, marauderFaction.reputation - 10);

                if (block.zombies <= 0) {
                    block.type = 'cleared';
                    block.zombies = 0;
                    block.factionControlledBy = null;
                    outcomeMessage = `${survivor.name} successfully attacked The Marauders' block [${block.x},${block.y}] and cleared it! Marauder reputation decreased. ⚔️`;
                    outcomeType = 'log-success';
                    gameState.totalBlocksCleared++;
                } else {
                    outcomeMessage = `${survivor.name} attacked The Marauders' block [${block.x},${block.y}], clearing ${clearedZombies} zombies. Marauder reputation decreased. ⚔️`;
                }
                if (Math.random() < 0.5) {
                    const bonusMaterials = Math.floor(Math.random() * 5) + 1;
                    gameState.materials += bonusMaterials;
                    outcomeMessage += ` Found ${bonusMaterials} materials from their stash!`;
                    outcomeType = 'log-resource';
                }
            } else {
                outcomeMessage = `${survivor.name} failed to attack The Marauders' block [${block.x},${block.y}]! ${survivor.name} was injured. 🤕`;
                outcomeType = 'log-danger';
                survivor.health = Math.max(0, survivor.health - 20);
                if (survivor.health < 50) survivor.isSick = true;
                marauderFaction.reputation = Math.min(100, marauderFaction.reputation + 5);
            }
            survivor.clearingSkill += (survivor.trait.name === "Quick Learner 🧠" ? 2 : 1);
            break;
    }

    logMessage(outcomeMessage, outcomeType);
    survivor.isBusy = false;
    survivor.currentTask = null;
    survivor.assignedBlock = null;
    survivor.daysRemaining = 0;
    checkAchievements(gameState);
}

export function recruitSurvivor(gameState, updateUI, checkAchievements, createRandomSurvivor) {
    const RECRUIT_FOOD_COST = 10;
    const RECRUIT_MATERIAL_COST = 5;

    if (gameState.survivors.length >= gameState.maxSurvivors) {
        logMessage("Cannot recruit: Maximum survivors reached! Build more Housing. 🏠", 'log-generic');
        return;
    }
    if (gameState.food < RECRUIT_FOOD_COST || gameState.materials < RECRUIT_MATERIAL_COST) {
        logMessage(`Cannot recruit: Need ${RECRUIT_FOOD_COST} food 🍎 and ${RECRUIT_MATERIAL_COST} materials 🧱.`, 'log-generic');
        return;
    }

    gameState.food -= RECRUIT_FOOD_COST;
    gameState.materials -= RECRUIT_MATERIAL_COST;

    const newSurvivor = createRandomSurvivor(gameState.day); // Pass current day for new recruits
    gameState.survivors.push(newSurvivor);
    gameState.totalSurvivorsRecruited++; // Increment total recruited
    logMessage(`A new survivor, ${newSurvivor.name} (${newSurvivor.trait.name}), joined your fort! Welcome! 🎉`, 'log-success');
    checkAchievements(gameState); // Check achievements after recruiting
    updateUI(gameState);
}

export function researchProject(key, gameState, updateUI, checkAchievements) {
    const project = gameState.research[key];
    if (!project || project.researched || gameState.researchPoints < project.cost) {
        logMessage("Cannot research: Not enough Research Points or already researched. 🧪", 'log-generic');
        return;
    }

    gameState.researchPoints -= project.cost;
    project.researched = true;

    // Apply research effects
    if (project.effect.scavengingBonus) {
        logMessage(`Research '${project.name}' completed! Scavenging tasks are now more efficient.`, 'log-research');
    }
    if (project.effect.buildingBonus) {
        logMessage(`Research '${project.name}' completed! Building tasks are now more efficient.`, 'log-research');
    }
    if (project.effect.fortDefenseBonus) {
        gameState.fortDefense = Math.min(MAX_FORT_DEFENSE, gameState.fortDefense + project.effect.fortDefenseBonus); // Apply max limit
        logMessage(`Research '${project.name}' completed! Fort defense permanently increased by ${project.effect.fortDefenseBonus}.`, 'log-research');
    }
    if (project.effect.illnessReduction) {
        logMessage(`Research '${project.name}' completed! Illnesses are now less severe.`, 'log-research');
    }

    checkAchievements(gameState); // Check achievements after research
    updateUI(gameState);
}

// --- Advisory/Consultancy Feature ---
export function advisoryConsult(gameState, updateUI, showEventChoiceModal, getSurvivorSkill, getSurvivorDefense) {
    if (gameState.day <= gameState.lastAdvisoryDay) {
        logMessage("Advisory can only be used once per day. ⏳", 'log-generic');
        return;
    }

    // Find an available survivor who qualifies as a consultant (combined skill total >= 5)
    const availableConsultants = gameState.survivors.filter(s =>
        !s.isBusy && !s.isSick &&
        (s.scavengingSkill + s.clearingSkill + s.buildingSkill) >= 5
    );

    if (availableConsultants.length === 0) {
        logMessage("No qualified survivors available for advisory today. Need a survivor with combined skill total of 5 or more. 😔", 'log-generic');
        return;
    }

    // Pick a random qualified consultant
    const consultant = availableConsultants[Math.floor(Math.random() * availableConsultants.length)];
    consultant.isBusy = true;
    consultant.currentTask = 'Consulting';
    gameState.lastAdvisoryDay = gameState.day; // Mark advisory as used for the day

    let advice = `${consultant.name} offers some advice: `;
    let adviceType = 'log-event';

    // Prioritize advice based on criticality
    if (gameState.food < 15) {
        advice += "Your food supplies are running low! Send more survivors to scavenge or build a farm. 🍎";
        adviceType = 'log-danger';
    } else if (gameState.materials < 10) {
        advice += "Materials are scarce. Focus on scavenging or building workshops to boost production. 🧱";
        adviceType = 'log-danger';
    } else if (gameState.survivors.filter(s => s.isSick).length > 0) {
        advice += "Some of your survivors are sick. Consider researching 'Basic Medicine' or building a Laboratory for better care. 🤒";
        adviceType = 'log-danger';
    } else if (getThreatBlocksInInfluenceZone(gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS).length > 0 && gameState.fortDefense < MAX_FORT_DEFENSE / 2) {
        advice += "Zombies are encroaching and your fort defenses are weak! Prioritize clearing nearby blocks or fortifying your defenses. 🧟";
        adviceType = 'log-danger';
    } else if (gameState.survivors.length < gameState.maxSurvivors && gameState.food >= 10 && gameState.materials >= 5) {
        advice += "You have space for more survivors. Recruiting new members will strengthen your group! 🧑‍🤝‍🧑";
        adviceType = 'log-generic';
    } else if (Object.values(gameState.research).some(p => !p.researched && p.unlocked)) {
        const labsBuilt = gameState.map.flat().filter(block => block.hasLab).length;
        if (labsBuilt === 0) {
            advice += "You have research projects available! Build a Laboratory to start generating Research Points. 🧪";
        } else {
            advice += "Don't forget to invest your Research Points in new technologies to improve your fort! 🔬";
        }
        adviceType = 'log-research';
    } else if (gameState.map.flat().filter(block => block.type === 'ruined' && !block.factionControlledBy && isInInfluenceZone(block.x, block.y, gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS)).length > 0) {
        advice += "There are still ruined blocks within your influence zone. Clearing them can expand your safe zone. 🗺️";
        adviceType = 'log-generic';
    } else {
        advice += "Things are looking stable. Keep expanding your territory and maintaining your resources! 👍";
        adviceType = 'log-success';
    }

    logMessage(advice, adviceType);
    updateUI(gameState);
}

export function nextDay(gameState, updateUI, stopFastForward, showWarningModal, completeTask, checkAchievements, showEventChoiceModal, getSurvivorSkill, getSurvivorDefense, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS, MAX_FORT_DEFENSE) {
    // Stop fast forward if active
    stopFastForward();

    // Check and show low resource warnings once per day
    if (gameState.food < 10 && gameState.day > gameState.lastFoodWarningDay) {
        showWarningModal("Low Food!", `You are critically low on food (${gameState.food}). Survivors will get hungry!`);
        gameState.lastFoodWarningDay = gameState.day;
    }
    if (gameState.materials < 5 && gameState.day > gameState.lastMaterialsWarningDay) {
        showWarningModal("Low Materials!", `You are critically low on materials (${gameState.materials}). You can't build!`);
        gameState.lastMaterialsWarningDay = gameState.day;
    }

    // Process tasks with duration
    gameState.survivors.forEach(s => {
        if (s.isBusy && s.daysRemaining > 0) { // Only process tasks with remaining days
            s.daysRemaining--;
            if (s.daysRemaining <= 0) {
                completeTask(s, gameState); // Complete the task and apply effects
            } else {
                logMessage(`${s.name} is still busy with ${s.currentTask} at [${s.assignedBlock.x},${s.assignedBlock.y}]. ${s.daysRemaining} day(s) left.`, 'log-generic');
            }
        }
    });

    // Heal sick survivors (regardless of busy status for tasks with duration)
    gameState.survivors.forEach(s => {
        if (s.isSick) {
            let healChance = 0.5;
            if (gameState.research.basic_medicine.researched) healChance += 0.3;
            if (gameState.map.flat().some(block => block.hasLab)) healChance += 0.1;

            if (Math.random() < healChance) {
                s.health = Math.min(100, s.health + (Math.random() * 10 + 10));
                if (s.health >= 50) {
                    s.isSick = false;
                    logMessage(`${s.name} has recovered from their illness! 😊`, 'log-success');
                } else {
                    logMessage(`${s.name} is still recovering from illness. Current health: ${s.health}%.`, 'log-event');
                }
            } else {
                s.health = Math.max(0, s.health - (Math.random() * 5 + 5));
                logMessage(`${s.name} is still sick. Their health is now ${s.health}%. 🤒`, 'log-event');
                if (s.health <= 0) {
                    gameState.survivors = gameState.survivors.filter(surv => surv.id !== s.id);
                    logMessage(`${s.name} succumbed to their illness! 💀`, 'log-danger');
                    if (gameState.day > gameState.lastSurvivorDeathWarningDay) {
                        showWarningModal("Survivor Lost!", `${s.name} succumbed to their illness!`);
                        gameState.lastSurvivorDeathWarningDay = gameState.day;
                    }
                }
            }
        }
    });

    // Daily food consumption
    const foodNeeded = gameState.survivors.length;
    if (gameState.food >= foodNeeded) {
        gameState.food -= foodNeeded;
        logMessage(`Consumed ${foodNeeded} food for survivors. 🍎`, 'log-resource');
    } else {
        const deficit = foodNeeded - gameState.food;
        gameState.food = 0;
        logMessage(`Not enough food! ${deficit} food deficit. Survivors are hungry. 😫`, 'log-danger');
        gameState.survivors.forEach(s => {
            s.health = Math.max(0, s.health - (deficit * 5));
            s.morale = Math.max(0, s.morale - (deficit * 3));
            if (s.health < 50) s.isSick = true;
        });
    }

    // Morale calculation (Individual)
    gameState.survivors.forEach(s => {
        let moraleChange = 0;

        // Housing impact (overcrowding)
        if (gameState.survivors.length > gameState.maxSurvivors) {
            moraleChange -= (gameState.survivors.length - gameState.maxSurvivors) * 1;
        }

        // Trait-based morale adjustments
        if (s.trait.name === "Optimistic 😊") {
            moraleChange += s.trait.effect.moraleBoost;
        } else if (s.trait.name === "Fearful 😨") {
            moraleChange -= s.trait.effect.moralePenalty;
        }

        // Health impact on morale
        if (s.health < 50) {
            moraleChange -= 5;
        }

        s.morale = Math.min(100, Math.max(0, s.morale + moraleChange));

        // Consequences of low individual morale
        if (s.morale < 25) {
            if (Math.random() < 0.1) {
                logMessage(`${s.name}'s low morale made them less effective today.`, 'log-event');
            }
        }
        if (s.morale < 10) {
            if (Math.random() < 0.05) {
                logMessage(`${s.name} lost all hope and left the fort! 💔`, 'log-danger');
                gameState.survivors = gameState.survivors.filter(surv => surv.id !== s.id);
                showWarningModal("Survivor Left!", `${s.name} lost all hope and left the fort!`);
            }
        }
    });


    // Passive production
    if (gameState.foodProduction > 0) {
        gameState.food += gameState.foodProduction;
        logMessage(`Farm produced ${gameState.foodProduction} food. 🌾`, 'log-resource');
    }
    if (gameState.materialProduction > 0) {
        gameState.materials += gameState.materialProduction;
        logMessage(`Workshops produced ${gameState.materialProduction} materials. ⚙️`, 'log-resource');
    }

    // Lab generates research points
    gameState.survivors.forEach(s => {
        if (s.currentResearchBlock) { // Check if survivor is assigned to a research block
            const labBlock = gameState.map[s.currentResearchBlock.y][s.currentResearchBlock.x];
            if (labBlock && labBlock.hasLab) { // Ensure the lab still exists
                const researchSkill = getSurvivorSkill(s, 'building'); // Using building skill as proxy for research
                const researchGained = 1 + Math.floor(researchSkill / 2); // 1 base + 1 for every 2 skill points
                gameState.researchPoints += researchGained;
                logMessage(`${s.name} generated ${researchGained} Research Points at the lab. 🧪`, 'log-research');
            } else {
                // If the lab was destroyed or no longer a lab, unassign the survivor
                s.currentResearchBlock = null;
                s.isBusy = false; // Free up as lab is gone
                s.currentTask = null;
                s.assignedBlock = null;
                s.daysRemaining = 0;
                logMessage(`${s.name} was unassigned from research as their Laboratory is no longer available.`, 'log-event');
            }
        }
    });


    // Simplified Zombie Attacks
    // Only consider zombie attacks from explored, ruined blocks within influence zone
    const ruinedThreatBlocks = getThreatBlocksInInfluenceZone(gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS);

    if (ruinedThreatBlocks.length > 0 && gameState.fortDefense < 20) {
        if (Math.random() < 0.35) {
            const attackStrength = Math.floor(Math.random() * 5) + 1;
            let effectiveFortDefense = gameState.fortDefense;
            if (gameState.research.better_defenses.researched) {
                effectiveFortDefense += gameState.research.better_defenses.effect.fortDefenseBonus;
            }

            if (attackStrength > effectiveFortDefense) {
                const availableSurvivors = gameState.survivors.filter(s => !s.isBusy && !s.isSick);
                if (availableSurvivors.length > 0) {
                    const attackedSurvivor = availableSurvivors[Math.floor(Math.random() * availableSurvivors.length)];
                    const damage = Math.floor(Math.random() * 20) + 10;
                    attackedSurvivor.health = Math.max(0, attackedSurvivor.health - damage);
                    if (attackedSurvivor.health < 50) attackedSurvivor.isSick = true;

                    if (attackedSurvivor.health <= 0) {
                        gameState.survivors = gameState.survivors.filter(s => s.id !== attackedSurvivor.id);
                        logMessage(`Zombie attack! Fort defenses breached, ${attackedSurvivor.name} was killed! 🧟💥`, 'log-danger');
                        if (gameState.day > gameState.lastSurvivorDeathWarningDay) {
                            showWarningModal("Survivor Lost!", `${attackedSurvivor.name} succumbed to the zombie attack!`);
                            gameState.lastSurvivorDeathWarningDay = gameState.day;
                        }
                    } else {
                        logMessage(`Zombie attack! Fort defenses breached, ${attackedSurvivor.name} was injured! Health: ${attackedSurvivor.health}%. 🤕`, 'log-danger');
                        if (gameState.day > gameState.lastSurvivorInjuryWarningDay) {
                            showWarningModal("Survivor Injured!", `${attackedSurvivor.name} was injured in a zombie attack! Health: ${attackedSurvivor.health}%.`);
                            gameState.lastSurvivorInjuryWarningDay = gameState.day;
                        }
                    }
                } else {
                    logMessage(`Zombie attack! Fort defenses breached, but no available survivors to defend. Fort defense took a hit! 💥`, 'log-danger');
                    gameState.fortDefense = Math.max(0, gameState.fortDefense - 5);
                    if (gameState.day > gameState.lastZombieAttackWarningDay) {
                        showWarningModal("Fort Attacked!", "Your fort was attacked by zombies! Defenses are weakening.");
                        gameState.lastZombieAttackWarningDay = gameState.day;
                    }
                }
            } else {
                logMessage(`Zombie attack repelled! Fort defenses held strong. 💪`, 'log-success');
            }
            gameState.fortDefense = Math.max(0, Math.min(MAX_FORT_DEFENSE, gameState.fortDefense - 1)); // Apply max limit
        }
    }

    // Faction Expansion (Light)
    const marauderFaction = gameState.factions.find(f => f.id === 'marauders');
    if (marauderFaction.reputation < 30 && Math.random() < 0.1) {
        const marauderBlocks = gameState.map.flat().filter(b => b.factionControlledBy === 'marauders');
        if (marauderBlocks.length > 0) {
            const randomMarauderBlock = marauderBlocks[Math.floor(Math.random() * marauderBlocks.length)];
            const adjacentEmptyRuinedBlocks = [];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = randomMarauderBlock.x + dx;
                    const ny = randomMarauderBlock.y + dy;
                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                        const block = gameState.map[ny][nx];
                        // V7.0: Only expand to blocks that are currently not faction-controlled and are unexplored
                        if (block.type === 'ruined' && !block.factionControlledBy && !block.isExplored) {
                            adjacentEmptyRuinedBlocks.push(block);
                        }
                    }
                }
            }
            if (adjacentEmptyRuinedBlocks.length > 0) {
                const targetBlock = adjacentEmptyRuinedBlocks[Math.floor(Math.random() * adjacentEmptyRuinedBlocks.length)];
                targetBlock.factionControlledBy = 'marauders';
                targetBlock.zombies = Math.floor(Math.random() * 3) + 1;
                marauderFaction.controlledBlocks.push({ x: targetBlock.x, y: targetBlock.y });
                logMessage(`The Marauders expanded their territory to [${targetBlock.x},${targetBlock.y}]! 😡`, 'log-danger');
            }
        }
    }


    // Random Events (now with potential choices)
    let eventTriggered = false;
    // Filter out 'Quiet Day' and events that require a choice modal if one is already active
    const possibleEvents = window.game.randomEvents.filter(event => event.name !== "Quiet Day" && !window.game.eventChoiceModal.classList.contains('hidden'));
    for (const event of possibleEvents) {
        if (Math.random() < event.chance) {
            event.execute(logMessage, gameState, showEventChoiceModal, getSurvivorSkill, getSurvivorDefense, createRandomSurvivor, checkAchievements, updateUI); // Pass necessary functions
            eventTriggered = true;
            break;
        }
    }
    if (!eventTriggered && !window.game.eventChoiceModal.classList.contains('hidden')) { // Check if modal is NOT hidden
        logMessage(`A calm day passes in the city. No major incidents. 🧘`, 'log-generic');
    }

    gameState.day++;
    logMessage(`Day ${gameState.day} begins. ☀️`, 'log-generic');
    window.game.checkVictoryCondition(gameState); // Access checkVictoryCondition from global game object
    checkAchievements(gameState); // Check achievements at the end of each day
    updateUI(gameState);
    // Do NOT reset selectedBlock or selectedSurvivorId here, as tasks might still be ongoing.
    // These are reset when a new task is assigned or modal is closed.
    // Reset daily warning flags and advisory flag
    gameState.lastFoodWarningDay = 0;
    gameState.lastMaterialsWarningDay = 0;
    gameState.lastZombieAttackWarningDay = 0;
    gameState.lastSurvivorInjuryWarningDay = 0;
    gameState.lastAdvisoryDay = 0;
}

export function updateInfluenceZone(gameState) {
    // Reset all blocks to not explored (except fort)
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const block = gameState.map[y][x];
            if (block.type !== 'fort') {
                block.isExplored = false;
            }
        }
    }

    // Mark blocks within Fort's influence as explored
    for (let dy = -FORT_INFLUENCE_RADIUS; dy <= FORT_INFLUENCE_RADIUS; dy++) {
        for (let dx = -FORT_INFLUENCE_RADIUS; dx <= FORT_INFLUENCE_RADIUS; dx++) {
            const nx = FORT_X + dx;
            const ny = FORT_Y + dy;
            if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                gameState.map[ny][nx].isExplored = true;
                gameState.map[ny][nx].isVisible = true; // Also ensure visibility
            }
        }
    }

    // Mark blocks within Scout Posts' influence as explored
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const block = gameState.map[y][x];
            if (block.hasScoutPost) {
                for (let dy = -SCOUT_POST_INFLUENCE_RADIUS; dy <= SCOUT_POST_INFLUENCE_RADIUS; dy++) {
                    for (let dx = -SCOUT_POST_INFLUENCE_RADIUS; dx <= SCOUT_POST_INFLUENCE_RADIUS; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                            gameState.map[ny][nx].isExplored = true;
                            gameState.map[ny][nx].isVisible = true; // Also ensure visibility
                        }
                    }
                }
            }
        }
    }
    renderMap(gameState); // Re-render map to show newly explored tiles
}

export function getAvailableActionsForBlock(block, gameState) {
    const actions = [];
    const inInfluence = isInInfluenceZone(block.x, block.y, gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS);

    // Expedition action
    const EXPEDITION_FOOD_COST = 5;
    const EXPEDITION_MATERIALS_COST = 5;
    if (block.type === 'ruined' && !block.isExplored && isAdjacentToExplored(block.x, block.y, gameState, MAP_SIZE)) {
        actions.push({
            type: 'expedition',
            label: '🔭 Expedition',
            tooltip: `Send a survivor to explore this unknown block. Costs ${EXPEDITION_FOOD_COST} Food, ${EXPEDITION_MATERIALS_COST} Materials.`,
            disabled: gameState.food < EXPEDITION_FOOD_COST || gameState.materials < EXPEDITION_MATERIALS_COST
        });
    }

    // Only show other actions if the block is explored AND within influence zone
    if (block.isExplored && inInfluence) {
        // Scavenge
        if (block.type === 'ruined' && !block.factionControlledBy) {
            actions.push({ type: 'scavenge', label: '🧺 Scavenge', tooltip: 'Gather food and materials from this ruined block.' });
        }

        // Clear
        if (block.type === 'ruined' && block.zombies > 0) {
            actions.push({ type: 'clear', label: '🧟‍♂️ Clear Zombies', tooltip: 'Reduce zombie count on this ruined block.' });
        }

        // Build/Repair (Fort)
        if (block.type === 'fort') {
            const fortBlock = gameState.map[FORT_Y][FORT_X];
            if (!fortBlock.hasFarm) {
                actions.push({ type: 'buildRepair', label: '🔨 Build Farm', tooltip: `Build a farm at the fort. Costs 10 materials.`, disabled: gameState.materials < 10 });
            } else {
                actions.push({ type: 'buildRepair', label: '🛡️ Repair Fort', tooltip: `Repair fort defenses. Costs 10 materials.`, disabled: gameState.materials < 10 || gameState.fortDefense >= MAX_FORT_DEFENSE });
            }
        }

        // Building types on cleared blocks
        if (block.type === 'cleared' && !block.hasHousing && !block.hasWorkshop && !block.hasLab && !block.hasWatchtower && !block.hasScoutPost && !block.factionControlledBy) {
            const HOUSING_COST = 20;
            actions.push({ type: 'buildHousing', label: '🏠 Build Housing', tooltip: `Build housing to increase max survivors. Costs ${HOUSING_COST} materials.`, disabled: gameState.materials < HOUSING_COST });

            const WORKSHOP_COST = 15;
            actions.push({ type: 'buildWorkshop', label: '⚙️ Build Workshop', tooltip: `Build a workshop for daily materials. Costs ${WORKSHOP_COST} materials.`, disabled: gameState.materials < WORKSHOP_COST });

            const LAB_COST = 25;
            actions.push({ type: 'buildLab', label: '🧪 Build Lab', tooltip: `Build a laboratory for research points. Costs ${LAB_COST} materials.`, disabled: gameState.materials < LAB_COST });

            const WATCHTOWER_COST = 20;
            actions.push({ type: 'buildWatchtower', label: '🗼 Build Watchtower', tooltip: `Build a watchtower to increase fort defense. Costs ${WATCHTOWER_COST} materials.`, disabled: gameState.materials < WATCHTOWER_COST || gameState.fortDefense >= MAX_FORT_DEFENSE });

            const SCOUT_POST_COST = 30;
            actions.push({ type: 'buildScoutPost', label: '🔭 Build Scout Post', tooltip: `Build a Scout Post to expand your influence zone. Costs ${SCOUT_POST_COST} materials.`, disabled: gameState.materials < SCOUT_POST_COST });
        }

        // Assign to Research (if it's a lab block and no one is assigned)
        if (block.type === 'cleared' && block.hasLab) {
            const isLabOccupied = gameState.survivors.some(s => s.currentResearchBlock && s.currentResearchBlock.x === block.x && s.currentResearchBlock.y === block.y);
            actions.push({ type: 'assignToResearch', label: '🔬 Assign to Research', tooltip: isLabOccupied ? 'This lab is already occupied.' : 'Assign a survivor to this lab to generate Research Points.', disabled: isLabOccupied });
        }

        // Trade (Nomad)
        if (block.type === 'ruined' && block.factionControlledBy === 'nomads') {
            actions.push({ type: 'trade', label: '🤝 Trade', tooltip: 'Trade resources with The Nomads.' });
        }

        // Attack Faction (Marauder)
        if (block.type === 'ruined' && block.factionControlledBy === 'marauders') {
            actions.push({ type: 'attackFaction', label: '⚔️ Attack Faction', tooltip: 'Attack The Marauders to clear their block.' });
        }
    }

    return actions;
}

export function handleTrade(traderSurvivor, type, amount, cost, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn) {
    const nomadFaction = gameState.factions.find(f => f.id === 'nomads');
    let success = false;
    if (type === 'buyMaterials' && gameState.food >= cost) {
        gameState.food -= cost;
        gameState.materials += amount;
        nomadFaction.reputation = Math.min(100, nomadFaction.reputation + 2); // Small reputation gain for trading
        logMessage(`${traderSurvivor.name} traded ${cost} food for ${amount} materials with The Nomads. 🤝`, 'log-action');
        success = true;
    } else if (type === 'buyFood' && gameState.materials >= cost) {
        gameState.materials -= cost;
        gameState.food += amount;
        nomadFaction.reputation = Math.min(100, nomadFaction.reputation + 2); // Small reputation gain for trading
        logMessage(`${traderSurvivor.name} traded ${cost} materials for ${amount} food with The Nomads. 🤝`, 'log-action');
        success = true;
    } else {
        logMessage("Trade failed: Not enough resources.", 'log-generic');
    }

    if (success) {
        hideGenericModal(tradeModal); // Use generic hide
        traderSurvivor.isBusy = false; // Trade is instant, so free up immediately
        traderSurvivor.currentTask = null;
        traderSurvivor.assignedBlock = null;
        traderSurvivor.daysRemaining = 0;
        gameState.selectedSurvivorId = null;
        gameState.selectedBlock = null;
        updateUI(gameState);
    } else {
        // Update trade modal buttons if trade failed due to resources
        tradeYourFood.textContent = gameState.food;
        tradeYourMaterials.textContent = gameState.materials;
        const nomadRep = gameState.factions.find(f => f.id === 'nomads').reputation;
        const foodToMaterialRate = 2 - (nomadRep / 100 * 0.5);
        const materialToFoodRate = 0.5 + (nomadRep / 100 * 0.25);

        const cost5Mat = Math.max(1, Math.round(5 * foodToMaterialRate));
        const cost10Mat = Math.max(1, Math.round(10 * foodToMaterialRate));
        const cost10Food = Math.max(1, Math.round(10 / materialToFoodRate));
        const cost20Food = Math.max(1, Math.round(20 / materialToFoodRate));

        tradeBuyMaterialsBtn.disabled = gameState.food < cost5Mat;
        tradeBuyMaterialsLargeBtn.disabled = gameState.food < cost10Mat;
        tradeBuyFoodBtn.disabled = gameState.materials < cost10Food;
        tradeBuyFoodLargeBtn.disabled = gameState.materials < cost20Food;
    }
}
