// js/uiUpdates.js

import { MAP_SIZE, FORT_X, FORT_Y, MAX_FORT_DEFENSE, SCOUT_POST_INFLUENCE_RADIUS } from './data.js';
import { getSurvivorSkill, getDistance, isInInfluenceZone } from './utils.js';
import { researchModalPoints, messageLogElement, logFilterElement, showWarningModal, showEventChoiceModal } from './modals.js'; // Import elements and functions from modals

// DOM Elements (will be assigned in main.js)
export let mapElement;
export let statDaySpan;
export let statSurvivorsCountSpan;
export let statMaxSurvivorsSpan;
export let statFoodSpan;
export let statMaterialsSpan;
export let statResearchPointsSpan;
export let statFortDefenseSpan;
export let statFoodProductionSpan;
export let statMaterialsProductionSpan;
export let statMoraleSpan;
export let statShelterQualitySpan;
export let statMedicalCareSpan;

// Function to set DOM elements from main.js
export function setUIDOMElements(elements) {
    ({
        mapElement, statDaySpan, statSurvivorsCountSpan, statMaxSurvivorsSpan,
        statFoodSpan, statMaterialsSpan, statResearchPointsSpan, statFortDefenseSpan,
        statFoodProductionSpan, statMaterialsProductionSpan, statMoraleSpan,
        statShelterQualitySpan, statMedicalCareSpan
    } = elements);
}

export function updateUI(gameState) {
    updateStats(gameState);
    renderMap(gameState);
    renderMessageLog(gameState); // Call to re-render log based on filter
}

export function updateStats(gameState) {
    statDaySpan.textContent = gameState.day;
    // Count available survivors (not busy, not sick)
    statSurvivorsCountSpan.textContent = gameState.survivors.filter(s => !s.isBusy && !s.isSick).length;
    statMaxSurvivorsSpan.textContent = gameState.maxSurvivors;

    // Resource Threshold Warnings
    statFoodSpan.textContent = gameState.food;
    if (gameState.food < 10) { // Critical low food
        statFoodSpan.classList.add('low-resource');
        // Warning modal for food is handled in nextDay to be once per day
    } else {
        statFoodSpan.classList.remove('low-resource');
    }

    statMaterialsSpan.textContent = gameState.materials;
    if (gameState.materials < 5) { // Critical low materials
        statMaterialsSpan.classList.add('low-resource');
        // Warning modal for materials is handled in nextDay to be once per day
    } else {
        statMaterialsSpan.classList.remove('low-resource');
    }

    statResearchPointsSpan.textContent = gameState.researchPoints;
    statFortDefenseSpan.textContent = gameState.fortDefense;
    statFoodProductionSpan.textContent = gameState.foodProduction;
    statMaterialsProductionSpan.textContent = gameState.materialProduction;

    // Calculate average morale for display
    const totalMorale = gameState.survivors.reduce((sum, s) => sum + s.morale, 0);
    const averageMorale = gameState.survivors.length > 0 ? Math.round(totalMorale / gameState.survivors.length) : 100;
    statMoraleSpan.textContent = `${averageMorale}%`;

    // Calculate Shelter Quality
    const housingBlocks = gameState.map.flat().filter(block => block.hasHousing).length;
    let shelterQuality = "Poor 🏚️";
    if (housingBlocks * 5 >= gameState.survivors.length) {
        shelterQuality = "Good 👍";
    } else if (housingBlocks * 5 >= gameState.survivors.length * 0.75) {
        shelterQuality = "Adequate 🏡";
    }
    statShelterQualitySpan.textContent = shelterQuality;

    // Calculate Medical Care
    const labBlocks = gameState.map.flat().filter(block => block.hasLab).length;
    let medicalCare = "Poor 🚨";
    if (labBlocks > 0 && gameState.research.basic_medicine.researched) {
        medicalCare = "Good 🏥";
    } else if (labBlocks > 0) {
        medicalCare = "Basic 🩹";
    }
    statMedicalCareSpan.textContent = medicalCare;

    // Update research points in research modal if open
    if (researchModalPoints && !researchModalPoints.closest('.modal-overlay').classList.contains('hidden')) {
        researchModalPoints.textContent = gameState.researchPoints;
    }
}

export function renderMap(gameState) {
    mapElement.innerHTML = '';
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const block = gameState.map[y][x];
            const blockDiv = document.createElement('div');
            blockDiv.classList.add('map-block');
            blockDiv.dataset.x = x;
            blockDiv.dataset.y = y;

            if (gameState.selectedBlock && gameState.selectedBlock.x === x && gameState.selectedBlock.y === y) {
                blockDiv.classList.add('selected');
            }

            let content = '';
            let tooltipText = '';

            if (!block.isVisible) { // Completely hidden block
                blockDiv.classList.add('unexplored');
                content = '???';
                tooltipText = 'Unexplored Territory';
                // No click listener for completely hidden blocks
            } else if (!block.isExplored) { // Visible but unexplored (can be explored via Expedition)
                blockDiv.classList.add('unexplored');
                blockDiv.classList.add('can-explore'); // Add class for clickable unexplored
                content = 'UNKNOWN';
                tooltipText = 'Unexplored Block: Click to send an Expedition.';
                blockDiv.addEventListener('click', () => {
                    const { selectBlock } = window.game; // Access selectBlock from global game object
                    selectBlock(x, y);
                });
            } else { // Explored block
                blockDiv.classList.add(block.type);
                if (block.factionControlledBy) {
                    blockDiv.classList.add('faction-controlled');
                }

                if (block.type === 'fort') {
                    content = 'FORT';
                    tooltipText = `Your Fort: Defense ${gameState.fortDefense}.`;
                    if (block.hasFarm) {
                        content += '<br>FARM 🌾';
                        tooltipText += ` Has a Farm (Food Prod: ${gameState.foodProduction}).`;
                    }
                } else if (block.type === 'cleared') {
                    content = 'CLEARED';
                    tooltipText = `Cleared Block: No zombies.`;
                    if (block.hasHousing) {
                        content += '<br>HOUSE 🏠';
                        tooltipText += ` Has Housing (+${5} Max Survivors).`;
                    } else if (block.hasWorkshop) {
                        content += '<br>WORKSHOP ⚙️';
                        tooltipText += ` Has a Workshop (+${3} Materials Prod).`;
                    } else if (block.hasLab) {
                        content += '<br>LAB 🧪';
                        tooltipText += ` Has a Laboratory.`;
                    } else if (block.hasWatchtower) {
                        content += '<br>TOWER 🗼';
                        tooltipText += ` Has a Watchtower (+${5} Fort Defense).`;
                    } else if (block.hasScoutPost) { // V7.0: new Scout Post
                        content += '<br>SCOUT 🔭';
                        tooltipText += ` Has a Scout Post (Explores ${SCOUT_POST_INFLUENCE_RADIUS}-tile radius).`;
                    }
                    else {
                        tooltipText += ` Ready for building.`;
                    }
                } else { // ruined (and isExplored)
                    content = 'RUINED';
                    tooltipText = `Ruined Block: Dangerous area.`;
                    if (block.factionControlledBy) {
                        const faction = gameState.factions.find(f => f.id === block.factionControlledBy);
                        content += `<br>${faction ? faction.name : 'Faction'}`;
                        tooltipText += ` Controlled by ${faction ? faction.name : 'an unknown faction'}.`;
                    }
                    if (block.zombies > 0) {
                        const zombieSpan = document.createElement('span');
                        zombieSpan.classList.add('zombie-count');
                        zombieSpan.textContent = `🧟x${block.zombies}`;
                        blockDiv.appendChild(zombieSpan);
                        tooltipText += ` Zombies: ${block.zombies}.`;
                    }
                    tooltipText += ` Potential Resources: ${block.resources}.`;
                }
                blockDiv.innerHTML += content;
                blockDiv.title = tooltipText; // Add tooltip
                blockDiv.addEventListener('click', () => {
                    const { selectBlock } = window.game; // Access selectBlock from global game object
                    selectBlock(x, y);
                });
            }

            // V7.1: Add survivor count overlay if survivors are assigned to this block
            const assignedSurvivorsCount = gameState.survivors.filter(s =>
                s.assignedBlock && s.assignedBlock.x === x && s.assignedBlock.y === y && s.currentTask !== 'Research'
            ).length;

            if (assignedSurvivorsCount > 0) {
                const survivorCountOverlay = document.createElement('span');
                survivorCountOverlay.classList.add('survivor-count-overlay');
                survivorCountOverlay.textContent = `🧑‍🤝‍🧑x${assignedSurvivorsCount}`;
                blockDiv.appendChild(survivorCountOverlay);
            }

            mapElement.appendChild(blockDiv);
        }
    }
}

export function logMessage(message, type = 'log-generic') {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const logEntry = {
        timestamp: timestamp,
        day: window.game.gameState.day, // Access gameState from global game object
        message: message,
        type: type
    };
    window.game.gameState.messageHistory.unshift(logEntry); // Add to the beginning

    // Keep log history to a reasonable size (e.g., 200 messages)
    if (window.game.gameState.messageHistory.length > 200) {
        window.game.gameState.messageHistory.pop();
    }
    renderMessageLog(window.game.gameState); // Re-render the log after adding a new message
}

export function renderMessageLog(gameState) {
    messageLogElement.innerHTML = '';
    const filterType = logFilterElement.value;

    const filteredMessages = gameState.messageHistory.filter(entry => {
        return filterType === 'all' || entry.type === filterType;
    });

    filteredMessages.forEach(entry => {
        const p = document.createElement('p');
        p.textContent = `[${entry.timestamp}] Day ${entry.day}: ${entry.message}`;
        p.classList.add(entry.type);
        messageLogElement.appendChild(p); // Append to display in correct order
    });
}

// Modified to render into a modal
export function renderSurvivorList(targetElement, gameState, showSurvivorDetailsInLog) {
    targetElement.innerHTML = '';
    if (gameState.survivors.length === 0) {
        targetElement.innerHTML = '<p class="text-center text-gray-500">No survivors left. Game over!</p>';
        return;
    }
    gameState.survivors.forEach(survivor => {
        const survivorDiv = document.createElement('div');
        survivorDiv.classList.add('survivor-list-item', 'rounded-lg', 'p-2', 'mb-2', 'cursor-pointer', 'border');
        if (survivor.isBusy || survivor.isSick) {
            survivorDiv.classList.add('busy');
        }
        if (gameState.selectedSurvivorId === survivor.id) {
            survivorDiv.classList.add('selected-survivor');
        }

        survivorDiv.dataset.id = survivor.id;
        survivorDiv.innerHTML = `
            <p class="font-bold text-gray-800">${survivor.name} <span class="trait">${survivor.trait.name}</span></p>
            <p class="text-sm text-gray-600">
                Health: <span class="font-bold ${survivor.health < 30 ? 'text-red-500' : 'text-green-600'}">${survivor.health}%</span> |
                Morale: <span class="font-bold ${survivor.morale < 30 ? 'text-red-500' : 'text-blue-600'}">${survivor.morale}%</span>
            </p>
            <p class="text-sm text-gray-600">
                Scav: <span class="skill-level">${survivor.scavengingSkill}</span> |
                Clear: <span class="skill-level">${survivor.clearingSkill}</span> |
                Build: <span class="skill-level">${survivor.buildingSkill}</span>
            </p>
            ${survivor.equippedItem ? `<p class="text-xs text-green-600">Equipped: ${survivor.equippedItem.name}</p>` : ''}
            ${survivor.isBusy ? `<p class="text-xs text-blue-500">BUSY (${survivor.currentTask || 'Task'} ${survivor.daysRemaining > 0 ? ` - ${survivor.daysRemaining} Days` : ''})</p>` : ''}
            ${survivor.isSick ? '<p class="text-xs text-red-500">SICK 🤒</p>' : ''}
        `;
        // Add event listener for clicking survivor in modal
        survivorDiv.addEventListener('click', () => showSurvivorDetailsInLog(survivor));
        targetElement.appendChild(survivorDiv);
    });
    // Access btnRecruitSurvivor from the global game object
    const btnRecruitSurvivor = window.game.btnRecruitSurvivor;
    btnRecruitSurvivor.disabled = (gameState.survivors.length >= gameState.maxSurvivors);
    if (btnRecruitSurvivor.disabled) {
        btnRecruitSurvivor.title = "Max survivors reached or not enough food/materials.";
    } else {
        btnRecruitSurvivor.title = "Recruit a new survivor (costs 10 food, 5 materials).";
    }
}

// Modified to render into a modal
export function renderInventoryList(targetElement, gameState) {
    targetElement.innerHTML = '';
    if (gameState.inventory.length === 0) {
        targetElement.innerHTML = '<p class="text-center text-gray-500">No items yet. Scavenge to find some!</p>';
        return;
    }
    gameState.inventory.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('bg-gray-50', 'rounded-md', 'p-2', 'mb-1', 'text-gray-700', 'flex', 'justify-between', 'items-center');
        itemDiv.innerHTML = `
            <span>${item.name} <span class="text-xs text-gray-500">(${item.type})</span></span>
            <span class="text-xs text-gray-600">${item.description}</span>
        `;
        targetElement.appendChild(itemDiv);
    });
}

// Modified to render into a modal
export function renderResearchList(targetElement, gameState) {
    targetElement.innerHTML = '';
    for (const key in gameState.research) {
        const project = gameState.research[key];
        if (!project.unlocked) continue;

        const researchDiv = document.createElement('div');
        researchDiv.classList.add('research-item', 'rounded-lg', 'p-3', 'mb-2', 'border');
        researchDiv.innerHTML = `
            <p class="font-bold text-gray-800">${project.name}</p>
            <p class="text-sm text-gray-600">${project.description}</p>
            <p class="text-sm text-gray-700 mt-1">Cost: ${project.cost} RP</p>
            <button data-research-key="${key}" class="research-button mt-2" ${project.researched || gameState.researchPoints < project.cost ? 'disabled' : ''}>
                ${project.researched ? 'Researched ✅' : 'Research'}
            </button>
        `;
        // Access researchProject from the global game object
        researchDiv.querySelector('button').addEventListener('click', (event) => window.game.researchProject(event.target.dataset.researchKey));
        targetElement.appendChild(researchDiv);
    }
}

// --- New: Stat Info Function ---
export function showStatInfo(statId, gameState) {
    let infoMessage = "";
    let messageType = 'log-generic';

    switch (statId) {
        case 'day':
            infoMessage = "The current day. Each day, survivors consume food, produce resources, and events may occur.";
            break;
        case 'survivors':
            infoMessage = `Survivors are your most valuable resource. They perform all tasks.
            To gain more: Use the 'Recruit Survivor' button (costs 10 Food, 5 Materials).
            To increase max capacity: Build 'Housing' on cleared blocks.`;
            messageType = 'log-resource';
            break;
        case 'food':
            infoMessage = `Food is consumed daily by your survivors. If you run out, survivors will lose health and morale.
            To gain more: Assign survivors to 'Scavenge' ruined blocks, or build a 'Farm' at your fort.`;
            messageType = 'log-resource';
            break;
        case 'materials':
            infoMessage = `Materials are essential for building structures and repairing your fort.
            To gain more: Assign survivors to 'Scavenge' ruined blocks, or build a 'Workshop' on cleared blocks.`;
            messageType = 'log-resource';
            break;
        case 'research-points':
            infoMessage = `Research Points (RP) are used to unlock new technologies.
            To gain more: Build a 'Laboratory' on a cleared block, then assign a survivor to 'Research' at it.`;
            messageType = 'log-research';
            break;
        case 'fort-defense':
            infoMessage = `Fort Defense protects your settlement from zombie attacks.
            To increase: Use the 'Repair Fort' action at your fort block, or build 'Watchtowers' on cleared blocks.`;
            messageType = 'log-action';
            break;
        case 'food-production':
            infoMessage = `Food Production is the amount of food automatically generated each day.
            To increase: Build a 'Farm' at your fort.`;
            messageType = 'log-resource';
            break;
        case 'materials-production':
            infoMessage = `Materials Production is the amount of materials automatically generated each day.
            To increase: Build 'Workshops' on cleared blocks.`;
            messageType = 'log-resource';
            break;
        case 'shelter-quality':
            infoMessage = `Shelter Quality reflects your survivors' living conditions. Good shelter helps maintain morale.
            To improve: Build more 'Housing' blocks to accommodate your growing population.`;
            messageType = 'log-action';
            break;
        case 'medical-care':
            infoMessage = `Medical Care affects how quickly sick survivors recover.
            To improve: Build a 'Laboratory' and research 'Basic Medicine'.`;
            messageType = 'log-action';
            break;
        case 'morale':
            infoMessage = `Average Morale reflects the overall happiness of your survivors. High morale boosts efficiency, low morale can lead to survivors leaving.
            To improve: Ensure sufficient food and housing, and respond positively to events.`;
            messageType = 'log-generic';
            break;
        default:
            infoMessage = "Information for this stat is not available.";
    }
    logMessage(`Stat Info (${statId.replace(/-/g, ' ').toUpperCase()}): ${infoMessage}`, messageType);
}

// --- New: Survivor Details in Log Function ---
export function showSurvivorDetailsInLog(survivor) {
    let healthStatus = "";
    if (survivor.health >= 80) {
        healthStatus = "Excellent! They are in peak condition.";
    } else if (survivor.health >= 50) {
        healthStatus = "Good. They are healthy and ready for tasks.";
    } else if (survivor.health >= 30) {
        healthStatus = "Fair. They might be feeling a bit unwell or tired.";
    } else if (survivor.health > 0) {
        healthStatus = "Poor. They are sick or severely injured and cannot perform tasks effectively.";
    } else {
        healthStatus = "Critical! They are on the brink of death.";
    }

    let moraleStatus = "";
    if (survivor.morale >= 80) {
        moraleStatus = "High! They are highly motivated and productive.";
    } else if (survivor.morale >= 50) {
        moraleStatus = "Good. They are content and performing well.";
    } else if (survivor.morale >= 30) {
        moraleStatus = "Low. They are feeling discouraged; this might affect their efficiency.";
    } else if (survivor.morale > 0) {
        moraleStatus = "Very Low. They are losing hope and might consider leaving.";
    } else {
        moraleStatus = "Broken. They are likely to leave or become completely ineffective.";
    }

    const equippedItem = survivor.equippedItem ? `Equipped: ${survivor.equippedItem.name} (${survivor.equippedItem.description})` : "No item equipped.";
    const currentActivity = survivor.isBusy
        ? `Currently busy with: ${survivor.currentTask || 'an unknown task'}${survivor.daysRemaining > 0 ? ` (${survivor.daysRemaining} Days Left)` : ''}.`
        : "Currently available for tasks.";
    const sickStatus = survivor.isSick ? "Status: SICK 🤒 (cannot perform tasks)" : "Status: Healthy";
    const assignedLocation = survivor.assignedBlock ? `Assigned to: [${survivor.assignedBlock.x},${survivor.assignedBlock.y}]` : "Not assigned to a specific block.";

    logMessage(`--- ${survivor.name} Details ---`, 'log-generic');
    logMessage(`Trait: ${survivor.trait.name} - ${survivor.trait.description}`, 'log-generic');
    logMessage(`Health (${survivor.health}%): ${healthStatus}`, 'log-generic');
    logMessage(`Morale (${survivor.morale}%): ${moraleStatus}`, 'log-generic');
    logMessage(`Skills: Scavenging ${survivor.scavengingSkill}, Clearing ${survivor.clearingSkill}, Building ${survivor.buildingSkill}`, 'log-generic');
    logMessage(equippedItem, 'log-generic');
    logMessage(currentActivity, 'log-generic');
    logMessage(sickStatus, 'log-generic');
    logMessage(assignedLocation, 'log-generic'); // New: show assigned location
    logMessage(`Joined on Day: ${survivor.dayJoined}`, 'log-generic');
    logMessage(`---------------------------`, 'log-generic');
}
