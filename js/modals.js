// js/modals.js

import { logMessage, updateUI, renderSurvivorList, renderInventoryList, renderResearchList } from './uiUpdates.js';
import { getSurvivorSkill, getSurvivorDefense } from './utils.js';
import { EQUIPMENT } from './data.js';
import { performAction, handleTrade } from './gameLogic.js'; // Import performAction and handleTrade

// DOM Elements (will be assigned in main.js)
export let eventChoiceModal;
export let eventChoiceTitle;
export let eventChoiceText;
export let eventChoiceButtons;

export let tradeModal;
export let tradeYourFood;
export let tradeYourMaterials;
export let nomadReputationDisplay;
export let tradeBuyMaterialsBtn;
export let tradeBuyMaterialsLargeBtn;
export let tradeBuyFoodBtn;
export let tradeBuyFoodLargeBtn;
export let closeTradeModalBtn;

export let equipItemModal;
export let equipModalTitle;
export let equipModalInstruction;
export let equipItemList;
export let closeEquipModalBtn;

export let blockActionSurvivorModal;
export let blockActionModalTitle;
export let blockActionModalDetails;
export let blockActionModalActions;
export let blockActionModalAssignedSurvivors;
export let blockActionModalAvailableSurvivors;
export let blockActionModalPerformBtn;
export let blockActionModalCancelBtn;

export let warningModal;
export let warningModalTitle;
export let warningModalText;
export let closeWarningModalBtn;

export let changelogModal;
export let closeChangelogModal;

export let survivorModal;
export let survivorModalList;
export let closeSurvivorModalBtn;

export let inventoryModal;
export let inventoryModalList;
export let closeInventoryModalBtn;

export let researchModal;
export let researchModalPoints;
export let researchModalList;
export let closeResearchModalBtn;

export let achievementsModal;
export let achievementsModalList;
export let closeAchievementsModalBtn;

// Internal state for modals
export let selectedActionInModal = null;
export let selectedSurvivorInModal = null;
export let currentBlockInModal = null; // Stores the block object that opened the modal
export let equipModalSelectedSurvivor = null; // For the multi-stage equip modal

// Function to set DOM elements from main.js
export function setModalDOMElements(elements) {
    ({
        eventChoiceModal, eventChoiceTitle, eventChoiceText, eventChoiceButtons,
        tradeModal, tradeYourFood, tradeYourMaterials, nomadReputationDisplay,
        tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn, closeTradeModalBtn,
        equipItemModal, equipModalTitle, equipModalInstruction, equipItemList, closeEquipModalBtn,
        blockActionSurvivorModal, blockActionModalTitle, blockActionModalDetails, blockActionModalActions,
        blockActionModalAssignedSurvivors, blockActionModalAvailableSurvivors, blockActionModalPerformBtn, blockActionModalCancelBtn,
        warningModal, warningModalTitle, warningModalText, closeWarningModalBtn,
        changelogModal, closeChangelogModal,
        survivorModal, survivorModalList, closeSurvivorModalBtn,
        inventoryModal, inventoryModalList, closeInventoryModalBtn,
        researchModal, researchModalPoints, researchModalList, closeResearchModalBtn,
        achievementsModal, achievementsModalList, closeAchievementsModalBtn
    } = elements);
}

// --- Generic Modal Functions ---
export function showGenericModal(modalElement) {
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open'); // Add class to prevent background scrolling
}

export function hideGenericModal(modalElement) {
    modalElement.classList.add('hidden');
    document.body.classList.remove('modal-open'); // Remove class to re-enable background scrolling
}

// --- Event Choice Modal Functions ---
export function showEventChoiceModal(title, text, choices, gameState) {
    eventChoiceTitle.textContent = title;
    eventChoiceText.textContent = text;
    eventChoiceButtons.innerHTML = '';

    choices.forEach(choice => {
        const button = document.createElement('button');
        button.classList.add('action-button');
        button.textContent = choice.text;
        button.onclick = () => {
            choice.action();
            hideGenericModal(eventChoiceModal); // Use generic hide
            updateUI(gameState);
        };
        eventChoiceButtons.appendChild(button);
    });
    showGenericModal(eventChoiceModal); // Use generic show
}

// --- Trade Modal Functions ---
export function showTradeModal(traderSurvivor, gameState) {
    tradeYourFood.textContent = gameState.food;
    tradeYourMaterials.textContent = gameState.materials;
    const nomadFaction = gameState.factions.find(f => f.id === 'nomads');
    nomadReputationDisplay.textContent = nomadFaction.reputation;

    const nomadRep = nomadFaction.reputation;
    const foodToMaterialRate = 2 - (nomadRep / 100 * 0.5); // Better rate with higher rep (e.g., 2 food/mat down to 1.5 food/mat)
    const materialToFoodRate = 0.5 + (nomadRep / 100 * 0.25); // Better rate with higher rep (e.g., 0.5 mat/food up to 0.75 mat/food)

    const cost5Mat = Math.max(1, Math.round(5 * foodToMaterialRate));
    const cost10Mat = Math.max(1, Math.round(10 * foodToMaterialRate));
    const cost10Food = Math.max(1, Math.round(10 / materialToFoodRate));
    const cost20Food = Math.max(1, Math.round(20 / materialToFoodRate));

    tradeBuyMaterialsBtn.textContent = `Buy 5 Materials (${cost5Mat} Food)`;
    tradeBuyMaterialsBtn.onclick = () => handleTrade(traderSurvivor, 'buyMaterials', 5, cost5Mat, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn);
    tradeBuyMaterialsBtn.disabled = gameState.food < cost5Mat;
    tradeBuyMaterialsBtn.title = gameState.food < cost5Mat ? "Not enough food" : "";

    tradeBuyMaterialsLargeBtn.textContent = `Buy 10 Materials (${cost10Mat} Food)`;
    tradeBuyMaterialsLargeBtn.onclick = () => handleTrade(traderSurvivor, 'buyMaterials', 10, cost10Mat, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn);
    tradeBuyMaterialsLargeBtn.disabled = gameState.food < cost10Mat;
    tradeBuyMaterialsLargeBtn.title = gameState.food < cost10Mat ? "Not enough food" : "";

    tradeBuyFoodBtn.textContent = `Buy 10 Food (${cost10Food} Materials)`;
    tradeBuyFoodBtn.onclick = () => handleTrade(traderSurvivor, 'buyFood', 10, cost10Food, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn);
    tradeBuyFoodBtn.disabled = gameState.materials < cost10Food;
    tradeBuyFoodBtn.title = gameState.materials < cost10Food ? "Not enough materials" : "";

    tradeBuyFoodLargeBtn.textContent = `Buy 20 Food (${cost20Food} Materials)`;
    tradeBuyFoodLargeBtn.onclick = () => handleTrade(traderSurvivor, 'buyFood', 20, cost20Food, gameState, hideGenericModal, tradeModal, tradeYourFood, tradeYourMaterials, tradeBuyMaterialsBtn, tradeBuyMaterialsLargeBtn, tradeBuyFoodBtn, tradeBuyFoodLargeBtn);
    tradeBuyFoodLargeBtn.disabled = gameState.materials < cost20Food;
    tradeBuyFoodLargeBtn.title = gameState.materials < cost20Food ? "Not enough materials" : "";

    closeTradeModalBtn.onclick = () => {
        // Only free up survivor if they were busy with 'Trading' and no trade was made
        if (traderSurvivor.isBusy && traderSurvivor.currentTask === 'Trading') {
            traderSurvivor.isBusy = false;
            traderSurvivor.currentTask = null;
            traderSurvivor.assignedBlock = null; // Clear assigned block
            traderSurvivor.daysRemaining = 0; // Clear days remaining
        }
        hideGenericModal(tradeModal); // Use generic hide
        updateUI(gameState);
    };

    // Survivor is already marked busy by performAction for 'trade'
    updateUI(gameState); // Update UI to show survivor is busy
    showGenericModal(tradeModal); // Use generic show
}

// --- Equip Item Modal Functions (Multi-stage) ---
export function openEquipItemModal(gameState, updateUI, handleEquipItem) {
    equipModalSelectedSurvivor = null; // Reset selection
    equipModalInstruction.textContent = "Select a survivor to equip an item:";
    renderEquipModalSurvivors(gameState, handleEquipItem);
    showGenericModal(equipItemModal); // Use generic show
}

export function renderEquipModalSurvivors(gameState, handleEquipItem) {
    equipItemList.innerHTML = ''; // Clear previous content
    const availableSurvivors = gameState.survivors.filter(s => !s.isBusy && !s.isSick); // Only available survivors can equip

    if (availableSurvivors.length === 0) {
        equipItemList.innerHTML = '<p class="text-center text-gray-500">No available survivors to equip items.</p>';
        return;
    }

    availableSurvivors.forEach(survivor => {
        const survivorDiv = document.createElement('div');
        survivorDiv.classList.add('survivor-list-item', 'modal-survivor-item', 'rounded-lg', 'p-2', 'mb-2', 'cursor-pointer', 'hover:bg-blue-50');
        survivorDiv.dataset.survivorId = survivor.id;
        survivorDiv.innerHTML = `
            <p class="font-bold text-gray-800">${survivor.name}</p>
            <p class="text-sm text-gray-600">Health: ${survivor.health}% | Morale: ${survivor.morale}%</p>
            ${survivor.equippedItem ? `<p class="text-xs text-green-600">Equipped: ${survivor.equippedItem.name}</p>` : ''}
        `;
        survivorDiv.onclick = () => {
            equipModalSelectedSurvivor = survivor;
            renderEquipModalItems(survivor, gameState, handleEquipItem);
        };
        equipItemList.appendChild(survivorDiv);
    });
}

export function renderEquipModalItems(survivor, gameState, handleEquipItem) {
    equipModalTitle.textContent = `Equip Item to ${survivor.name} 🎒`;
    equipModalInstruction.textContent = 'Choose an item from your inventory:';
    equipItemList.innerHTML = ''; // Clear previous content

    // Add an "Unequip" option if the survivor has an item
    if (survivor.equippedItem) {
        const unequipDiv = document.createElement('div');
        unequipDiv.classList.add('bg-red-100', 'rounded-md', 'p-2', 'mb-2', 'flex', 'justify-between', 'items-center', 'cursor-pointer', 'hover:bg-red-200');
        unequipDiv.innerHTML = `
            <span>Unequip ${survivor.equippedItem.name}</span>
            <button class="action-button bg-red-600 hover:bg-red-700 py-1 px-2 text-sm">Unequip</button>
        `;
        unequipDiv.querySelector('button').onclick = () => handleEquipItem(survivor, -1, gameState, hideGenericModal, equipItemModal, updateUI); // -1 to signify unequip
        equipItemList.appendChild(unequipDiv);
    }

    if (gameState.inventory.length === 0) {
        equipItemList.innerHTML += '<p class="text-center text-gray-500">No items in inventory.</p>';
    } else {
        gameState.inventory.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('bg-gray-50', 'rounded-md', 'p-2', 'mb-2', 'flex', 'justify-between', 'items-center', 'cursor-pointer', 'hover:bg-blue-50');
            itemDiv.innerHTML = `
                <span>${item.name} <span class="text-xs text-gray-500">(${item.type})</span></span>
                <button data-item-index="${index}" class="action-button py-1 px-2 text-sm">Equip</button>
            `;
            itemDiv.querySelector('button').onclick = (event) => {
                const itemIndex = parseInt(event.target.dataset.itemIndex);
                handleEquipItem(survivor, itemIndex, gameState, hideGenericModal, equipItemModal, updateUI);
            };
            equipItemList.appendChild(itemDiv);
        });
    }
}

export function handleEquipItem(targetSurvivor, itemIndex, gameState, hideGenericModal, equipItemModal, updateUI) {
    if (itemIndex === -1) { // Unequip action
        if (targetSurvivor.equippedItem) {
            gameState.inventory.push(targetSurvivor.equippedItem);
            logMessage(`${targetSurvivor.name} unequipped ${targetSurvivor.equippedItem.name}.`, 'log-action');
            targetSurvivor.equippedItem = null;
        }
    } else { // Equip new item
        const itemToEquip = gameState.inventory[itemIndex];
        if (itemToEquip) {
            if (targetSurvivor.equippedItem) { // Unequip existing item first
                gameState.inventory.push(targetSurvivor.equippedItem);
            }
            gameState.inventory.splice(itemIndex, 1); // Remove from inventory
            targetSurvivor.equippedItem = itemToEquip; // Assign to survivor
            logMessage(`${targetSurvivor.name} equipped ${itemToEquip.name}!`, 'log-action');
        } else {
            logMessage("Error equipping item.", 'log-danger');
            return; // Don't close modal on error
        }
    }
    hideGenericModal(equipItemModal); // Use generic hide
    targetSurvivor.isBusy = true; // Still mark busy for the day
    targetSurvivor.currentTask = 'Equipping Item';
    targetSurvivor.assignedBlock = null; // No specific block for equipping
    targetSurvivor.daysRemaining = 0; // Instant action
    updateUI(gameState);
}

// --- Block Action & Survivor Selection Modal Functions ---
export function showBlockActionSurvivorModal(block, gameState, getAvailableActionsForBlock, showSurvivorDetailsInLog) {
    currentBlockInModal = block; // Store the block that opened the modal
    selectedActionInModal = null; // Reset selections
    selectedSurvivorInModal = null;

    blockActionModalTitle.textContent = `Block [${block.x}, ${block.y}] Details & Actions`;

    // Populate block details
    let detailsHtml = `<p><strong>Type:</strong> ${block.type.toUpperCase()}</p>`;
    if (!block.isExplored) { // V7.0: Show limited info for unexplored blocks
        detailsHtml += `<p><strong>Status:</strong> Unexplored Territory</p>`;
    } else {
        if (block.type === 'ruined') {
            detailsHtml += `<p><strong>Zombies:</strong> ${block.zombies}</p>`;
            detailsHtml += `<p><strong>Potential Resources:</strong> ${block.resources}</p>`;
            if (block.factionControlledBy) {
                const faction = gameState.factions.find(f => f.id === block.factionControlledBy);
                detailsHtml += `<p><strong>Controlled by:</strong> ${faction ? faction.name : 'Unknown Faction'}</p>`;
            }
        } else if (block.type === 'cleared' || block.type === 'fort') {
            const buildings = [];
            if (block.hasFarm) buildings.push('Farm 🌾');
            if (block.hasHousing) buildings.push('Housing 🏠');
            if (block.hasWorkshop) buildings.push('Workshop ⚙️');
            if (block.hasLab) buildings.push('Laboratory 🧪');
            if (block.hasWatchtower) buildings.push('Watchtower 🗼');
            if (block.hasScoutPost) buildings.push('Scout Post 🔭');
            detailsHtml += `<p><strong>Buildings:</strong> ${buildings.length > 0 ? buildings.join(', ') : 'None'}</p>`;
        }
    }
    blockActionModalDetails.innerHTML = detailsHtml;

    // V7.1: Populate assigned survivors for this block
    blockActionModalAssignedSurvivors.innerHTML = '';
    const assignedSurvivorsToBlock = gameState.survivors.filter(s =>
        s.assignedBlock && s.assignedBlock.x === block.x && s.assignedBlock.y === block.y
    );
    if (assignedSurvivorsToBlock.length > 0) {
        assignedSurvivorsToBlock.forEach(survivor => {
            blockActionModalAssignedSurvivors.innerHTML += `
                <p class="mb-1">
                    <span class="font-bold">${survivor.name}</span>: ${survivor.currentTask}
                    ${survivor.daysRemaining > 0 ? ` (${survivor.daysRemaining} Days Left)` : ''}
                </p>
            `;
        });
    } else {
        blockActionModalAssignedSurvivors.innerHTML = '<p class="text-center text-gray-500">No survivors currently assigned here.</p>';
    }

    // Populate available actions
    blockActionModalActions.innerHTML = '';
    const availableActions = getAvailableActionsForBlock(block, gameState);
    if (availableActions.length === 0) {
        blockActionModalActions.innerHTML = '<p class="text-center text-gray-500 col-span-2">No specific actions available for this block.</p>';
    }
    availableActions.forEach(action => {
        const button = document.createElement('button');
        button.classList.add('action-button', 'modal-action-button');
        button.textContent = action.label;
        button.dataset.actionType = action.type;
        button.title = action.tooltip;
        button.disabled = action.disabled; // Disable if conditions not met (e.g., cost)

        button.onclick = () => {
            // Remove 'selected' from all action buttons
            document.querySelectorAll('#block-action-modal-actions .modal-action-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Add 'selected' to the clicked button
            button.classList.add('selected');
            selectedActionInModal = action.type;
            updatePerformButtonState();
        };
        blockActionModalActions.appendChild(button);
    });

    // Populate available survivors
    blockActionModalAvailableSurvivors.innerHTML = '';
    const availableSurvivors = gameState.survivors.filter(s => !s.isBusy && !s.isSick);
    if (availableSurvivors.length === 0) {
        blockActionModalAvailableSurvivors.innerHTML = '<p class="text-center text-gray-500">No survivors available for tasks.</p>';
    }
    availableSurvivors.forEach(survivor => {
        const survivorDiv = document.createElement('div');
        survivorDiv.classList.add('survivor-list-item', 'modal-survivor-item', 'rounded-lg', 'p-2', 'mb-2', 'cursor-pointer', 'border');
        survivorDiv.dataset.survivorId = survivor.id;
        survivorDiv.innerHTML = `
            <p class="font-bold text-gray-800">${survivor.name} <span class="trait">${survivor.trait.name}</span></p>
            <p class="text-sm text-gray-600">
                Health: <span class="font-bold ${survivor.health < 30 ? 'text-red-500' : 'text-green-600'}">${survivor.health}%</span> |
                Morale: <span class="font-bold ${survivor.morale < 30 ? 'text-red-500' : 'text-blue-600'}">${survivor.morale}%</span>
            </p>
            <p class="text-sm text-gray-600">
                Scav: <span class="skill-level">${getSurvivorSkill(survivor, 'scavenging')}</span> |
                Clear: <span class="skill-level">${getSurvivorSkill(survivor, 'clearing')}</span> |
                Build: <span class="skill-level">${getSurvivorSkill(survivor, 'building')}</span>
            </p>
            ${survivor.equippedItem ? `<p class="text-xs text-green-600">Equipped: ${survivor.equippedItem.name}</p>` : ''}
        `;
        survivorDiv.onclick = () => {
            // Remove 'selected' from all survivor items
            document.querySelectorAll('#block-action-modal-available-survivors .modal-survivor-item').forEach(item => {
                item.classList.remove('selected');
            });
            // Add 'selected' to the clicked item
            survivorDiv.classList.add('selected');
            selectedSurvivorInModal = survivor.id;
            updatePerformButtonState();
        };
        blockActionModalAvailableSurvivors.appendChild(survivorDiv);
    });

    updatePerformButtonState(); // Initial state for the perform button
    showGenericModal(blockActionSurvivorModal); // Use generic show
}

export function hideBlockActionSurvivorModal(gameState, updateUI) {
    hideGenericModal(blockActionSurvivorModal); // Use generic hide
    gameState.selectedBlock = null; // Clear map selection
    selectedActionInModal = null;
    selectedSurvivorInModal = null;
    currentBlockInModal = null;
    updateUI(gameState); // Re-render to clear map selection
}

export function updatePerformButtonState() {
    if (selectedActionInModal && selectedSurvivorInModal) {
        blockActionModalPerformBtn.disabled = false;
        blockActionModalPerformBtn.title = "Assign selected survivor to selected task.";
    } else {
        blockActionModalPerformBtn.disabled = true;
        blockActionModalPerformBtn.title = "Select an action and an available survivor.";
    }
}

export function performTaskFromModal(gameState, performAction, hideBlockActionSurvivorModal, updateUI) {
    if (!selectedActionInModal || !selectedSurvivorInModal || !currentBlockInModal) {
        logMessage("Error: Action, survivor, or block not selected for task.", 'log-danger');
        return;
    }

    const survivor = gameState.survivors.find(s => s.id === selectedSurvivorInModal);
    if (!survivor) {
        logMessage("Error: Selected survivor not found.", 'log-danger');
        return;
    }

    const success = performAction(selectedActionInModal, survivor, currentBlockInModal, gameState);
    if (success) {
        hideBlockActionSurvivorModal(gameState, updateUI);
    } else {
        // If performAction returns false, it means the action couldn't be performed on this block
        // The logMessage inside performAction already handles the specific reason.
        // Keep the modal open to allow user to choose another action/survivor or cancel.
        // Re-render the modal content to reflect any changes if action failed.
        // No need to re-open, it's already open. Just update its state.
        updatePerformButtonState(); // Re-evaluate button state
        showBlockActionSurvivorModal(currentBlockInModal, gameState, getAvailableActionsForBlock, showSurvivorDetailsInLog); // Re-render modal to show updated state
    }
}

export function showChangelogModal() {
    showGenericModal(changelogModal);
}

export function hideChangelogModal() {
    hideGenericModal(changelogModal);
}

export function showWarningModal(title, message) {
    warningModalTitle.textContent = title;
    warningModalText.textContent = message;
    showGenericModal(warningModal);
}

export function hideWarningModal() {
    hideGenericModal(warningModal);
}

// --- New Modal Functions for Sidebar Sections ---
export function showSurvivorModal(gameState, showSurvivorDetailsInLog) {
    renderSurvivorList(survivorModalList, gameState, showSurvivorDetailsInLog); // Render into the modal's list area
    showGenericModal(survivorModal);
}

export function hideSurvivorModal() {
    hideGenericModal(survivorModal);
}

export function showInventoryModal(gameState) {
    renderInventoryList(inventoryModalList, gameState); // Render into the modal's list area
    showGenericModal(inventoryModal);
}

export function hideInventoryModal() {
    hideGenericModal(inventoryModal);
}

export function showResearchModal(gameState) {
    researchModalPoints.textContent = gameState.researchPoints; // Update points display
    renderResearchList(researchModalList, gameState); // Render into the modal's list area
    showGenericModal(researchModal);
}

export function hideResearchModal() {
    hideGenericModal(researchModal);
}

export function showAchievementsModal(gameState) {
    achievementsModalList.innerHTML = ''; // Clear previous content

    for (const key in gameState.achievements) {
        const achievement = gameState.achievements[key];
        const achDiv = document.createElement('div');
        achDiv.classList.add('achievement-item', 'rounded-lg', 'p-3', 'mb-2', 'border');
        if (achievement.unlocked) {
            achDiv.classList.add('unlocked');
        }
        achDiv.innerHTML = `
            <p class="font-bold text-gray-800">${achievement.name} ${achievement.unlocked ? '✅' : '🔒'}</p>
            <p class="text-sm text-gray-600">${achievement.description}</p>
            ${!achievement.unlocked ? `<p class="text-xs text-gray-500 mt-1">Progress: ${
                key === "master_researcher"
                ? `${Object.values(gameState.research).filter(p => p.researched).length}/${achievement.target}`
                : key === "recruiter"
                ? `${gameState.totalSurvivorsRecruited}/${achievement.target}`
                : key === "fort_defender"
                ? `${gameState.fortDefense}/${achievement.target}`
                : `${gameState.totalBlocksCleared}/${achievement.target}`
            }</p>` : ''}
        `;
        achievementsModalList.appendChild(achDiv);
    }
    showGenericModal(achievementsModal);
}

export function hideAchievementsModal() {
    hideGenericModal(achievementsModal);
}
