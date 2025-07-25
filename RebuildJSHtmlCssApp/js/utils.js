// js/utils.js

import { FIRST_NAMES, LAST_NAMES, TRAITS } from './data.js';

export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function getRandomName() {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${firstName} ${lastName}`;
}

export function getRandomTrait() {
    return TRAITS[Math.floor(Math.random() * TRAITS.length)];
}

export function createRandomSurvivor(dayJoined) {
    return {
        id: generateUniqueId(),
        name: getRandomName(),
        scavengingSkill: Math.floor(Math.random() * 3), // 0-2
        clearingSkill: Math.floor(Math.random() * 3),
        buildingSkill: Math.floor(Math.random() * 3),
        health: 100, // New: initial health
        morale: 75,  // New: initial morale
        isBusy: false,
        isSick: false, // Derived from health
        trait: getRandomTrait(),
        equippedItem: null,
        currentTask: null, // New: Stores the current task for display
        currentResearchBlock: null, // New: Stores the block a survivor is researching at
        dayJoined: dayJoined, // Use the passed dayJoined
        daysRemaining: 0, // V7.1: Days remaining for current task
        assignedBlock: null // V7.1: Block assigned to for task
    };
}

// New function to create a group leader with guaranteed skills
export function createGroupLeader(dayJoined) {
    let leader = createRandomSurvivor(dayJoined);
    // Ensure combined skill is at least 5
    while ((leader.scavengingSkill + leader.clearingSkill + leader.buildingSkill) < 5) {
        leader.scavengingSkill = Math.floor(Math.random() * 3) + 1; // 1-3
        leader.clearingSkill = Math.floor(Math.random() * 3) + 1;
        leader.buildingSkill = Math.floor(Math.random() * 3) + 1;
    }
    leader.name = "Commander " + getRandomName().split(' ')[1]; // Give a distinct name
    leader.trait = TRAITS.find(t => t.name === "Quick Learner 🧠") || getRandomTrait(); // Prefer Quick Learner for leader
    return leader;
}

// Manhattan distance (or Chebyshev for square grid influence)
export function getDistance(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function getSurvivorSkill(survivor, skillType) {
    let baseSkill = survivor[`${skillType}Skill`];
    let itemBonus = 0;
    if (survivor.equippedItem && survivor.equippedItem.effect[skillType]) {
        itemBonus = survivor.equippedItem.effect[skillType];
    }
    return baseSkill + itemBonus;
}

export function getSurvivorDefense(survivor) {
    let baseDefense = 0; // Survivors don't have base defense skill
    let itemBonus = 0;
    if (survivor.equippedItem && survivor.equippedItem.effect.defense) {
        itemBonus = survivor.equippedItem.effect.defense;
    }
    return baseDefense + itemBonus;
}

// V7.1: New function to calculate task duration
export function calculateTaskDuration(actionType, blockX, blockY, FORT_X, FORT_Y) {
    const distance = getDistance(blockX, blockY, FORT_X, FORT_Y);
    let baseDuration = 1; // Minimum 1 day for any task

    switch (actionType) {
        case 'expedition':
            baseDuration = 1;
            break;
        case 'scavenge':
            baseDuration = 1;
            break;
        case 'clear':
            baseDuration = 1;
            break;
        case 'buildRepair':
        case 'buildHousing':
        case 'buildWorkshop':
        case 'buildLab':
        case 'buildWatchtower':
        case 'buildScoutPost':
            baseDuration = 1;
            break;
        case 'trade': // Trade is instant, handled by modal
        case 'assignToResearch': // Research is continuous, not a single-turn task
            return 0; // No days remaining for these
        case 'attackFaction':
            baseDuration = 1;
            break;
    }
    // Add distance penalty, minimum 1 day
    return Math.max(1, baseDuration + Math.floor(distance / 2));
}

// Helper to check if a block is adjacent to any explored block
export function isAdjacentToExplored(x, y, gameState, MAP_SIZE) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                if (gameState.map[ny][nx].isExplored) {
                    return true;
                }
            }
        }
    }
    return false;
}

// New: Check if a block is within the influence zone of Fort or any Scout Post
export function isInInfluenceZone(x, y, gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS) {
    // Check Fort's influence
    if (getDistance(x, y, FORT_X, FORT_Y) <= FORT_INFLUENCE_RADIUS) {
        return true;
    }

    // Check Scout Posts' influence
    for (let sy = 0; sy < MAP_SIZE; sy++) {
        for (let sx = 0; sx < MAP_SIZE; sx++) {
            const block = gameState.map[sy][sx];
            if (block.hasScoutPost) {
                if (getDistance(x, y, sx, sy) <= SCOUT_POST_INFLUENCE_RADIUS) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function getThreatBlocksInInfluenceZone(gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS) {
    const threatBlocks = [];
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const block = gameState.map[y][x];
            if (block.type === 'ruined' && block.zombies > 0 && block.isExplored && isInInfluenceZone(x, y, gameState, MAP_SIZE, FORT_X, FORT_Y, FORT_INFLUENCE_RADIUS, SCOUT_POST_INFLUENCE_RADIUS)) {
                threatBlocks.push(block);
            }
        }
    }
    return threatBlocks;
}
