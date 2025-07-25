// js/data.js

export const MAP_SIZE = 7; // Map is MAP_SIZE x MAP_SIZE
export const FORT_X = Math.floor(MAP_SIZE / 2);
export const FORT_Y = Math.floor(MAP_SIZE / 2);
export const VICTORY_CLEARED_BLOCKS = 10; // Number of cleared blocks needed for victory (excluding fort)
export const MAX_FORT_DEFENSE = 50; // Maximum fort defense limit
export const FORT_INFLUENCE_RADIUS = 1; // Fort influences 1 tile radius (adjacent)
export const SCOUT_POST_INFLUENCE_RADIUS = 2; // Scout Post influences 2 tile radius

// IndexedDB setup
export const DB_NAME = 'ResurgentCityDB';
export const STORE_NAME = 'gameStateStore';
export const DB_VERSION = 4; // Increment to 4 for V7.1 changes (task duration, assignedBlock, daysRemaining)

// Survivor Naming
export const FIRST_NAMES = ["Alex", "Blake", "Casey", "Dakota", "Emerson", "Finley", "Harper", "Jamie", "Kai", "Morgan", "Riley", "Skylar", "Taylor", "Quinn"];
export const LAST_NAMES = ["Smith", "Jones", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson"];
export const TRAITS = [
    { name: "Strong 💪", effect: { clearing: 1, building: 1 }, description: "+1 bonus to Clearing and Building tasks." },
    { name: "Quick Learner 🧠", effect: { skillGain: 1 }, description: "Gains skills faster." },
    { name: "Optimistic 😊", effect: { moraleBoost: 5 }, description: "Slightly boosts daily morale." },
    { name: "Clumsy 😬", effect: { failChance: 0.1 }, description: "Small chance to fail tasks." },
    { name: "Resourceful 💡", effect: { scavenging: 1 }, description: "+1 bonus to Scavenging tasks." },
    { name: "Medic ⚕️", effect: { illnessResist: true }, description: "Reduces chance of illness spreading." },
    { name: "Fearful 😨", effect: { moralePenalty: 5 }, description: "Slightly reduces daily morale." }
];

// Research Projects
export const RESEARCH_PROJECTS = {
    "improved_tools": {
        name: "Improved Tools",
        cost: 20,
        researched: false,
        effect: { scavengingBonus: 2, buildingBonus: 2 },
        description: "Boosts scavenging and building task efficiency.",
        unlocked: true
    },
    "better_defenses": {
        name: "Better Defenses",
        cost: 30,
        researched: false,
        effect: { fortDefenseBonus: 5 },
        description: "Permanently increases fort defense.",
        unlocked: true
    },
    "basic_medicine": {
        name: "Basic Medicine",
        cost: 25,
        researched: false,
        effect: { illnessReduction: true },
        description: "Reduces the impact of illnesses.",
        unlocked: true
    }
};

// Equipment
export const EQUIPMENT = {
    "makeshift_tools": { id: "makeshift_tools", name: "Makeshift Tools 🛠️", type: "tool", effect: { scavenging: 1, building: 1 }, description: "+1 Scavenging & Building." },
    "crude_armor": { id: "crude_armor", name: "Crude Armor 🪖", type: "armor", effect: { defense: 1 }, description: "+1 Defense for survivor." },
    "sharp_knife": { id: "sharp_knife", name: "Sharp Knife 🔪", type: "weapon", effect: { clearing: 1 }, description: "+1 Clearing." }
};

// Faction Data
export const FACTIONS = [
    { id: "marauders", name: "The Marauders", attitude: "hostile", controlledBlocks: [], reputation: 50 }, // Initial reputation
    { id: "nomads", name: "The Nomads", attitude: "neutral", controlledBlocks: [], reputation: 50 } // Initial reputation
];

// Achievement Definitions
export const ACHIEVEMENTS = {
    "first_clear": {
        name: "First Clear",
        description: "Clear your first ruined block.",
        target: 1,
        unlocked: false
    },
    "recruiter": {
        name: "Recruiter",
        description: "Recruit 10 survivors.",
        target: 10,
        unlocked: false
    },
    "fort_defender": {
        name: "Fort Defender",
        description: "Reach 30 Fort Defense.",
        target: 30,
        unlocked: false
    },
    "master_researcher": {
        name: "Master Researcher",
        description: "Research all available projects.",
        target: Object.keys(RESEARCH_PROJECTS).length,
        unlocked: false
    },
    "city_reclaimer": {
        name: "City Reclaimer",
        description: "Clear 20 ruined blocks.",
        target: 20,
        unlocked: false
    }
};

// Random Events
export const randomEvents = [
    {
        name: "Scavenger's Find",
        chance: 0.15,
        execute: (logMessage, gameState) => { // Pass logMessage and gameState
            const bonusFood = Math.floor(Math.random() * 10) + 5;
            gameState.food += bonusFood;
            logMessage(`A lone scavenger found a hidden stash! +${bonusFood} food. 🤩`, 'log-resource');
        }
    },
    {
        name: "Minor Illness Outbreak",
        chance: 0.08,
        execute: (logMessage, gameState) => {
            const healthySurvivors = gameState.survivors.filter(s => !s.isSick);
            if (healthySurvivors.length > 0) {
                const sickSurvivor = healthySurvivors[Math.floor(Math.random() * healthySurvivors.length)];
                sickSurvivor.health = Math.max(0, sickSurvivor.health - (Math.random() * 20 + 10)); // Lose 10-30 health
                sickSurvivor.isSick = true;
                logMessage(`${sickSurvivor.name} got sick! Their health is now ${sickSurvivor.health}%. 😷`, 'log-event');
            } else {
                logMessage(`A minor illness was detected, but no healthy survivors to infect. 😌`, 'log-event');
            }
        }
    },
    {
        name: "Material Cache",
        chance: 0.10,
        execute: (logMessage, gameState) => {
            const bonusMaterials = Math.floor(Math.random() * 8) + 3;
            gameState.materials += bonusMaterials;
            logMessage(`Discovered a small cache of materials! +${bonusMaterials} materials. ✨`, 'log-resource');
        }
    },
    {
        name: "Rival Demand (Marauders)",
        chance: 0.05,
        execute: (logMessage, gameState, showEventChoiceModal) => { // Pass showEventChoiceModal
            const marauderFaction = gameState.factions.find(f => f.id === 'marauders');
            const demandedFood = Math.floor(Math.random() * 10) + 10;
            showEventChoiceModal(
                "Marauder Demand! 😠",
                `The Marauders are at your gates, demanding ${demandedFood} food! What will you do?`,
                [
                    {
                        text: `Pay (${demandedFood} Food)`,
                        action: () => {
                            if (gameState.food >= demandedFood) {
                                gameState.food -= demandedFood;
                                marauderFaction.reputation = Math.min(100, marauderFaction.reputation + 10);
                                logMessage(`You paid The Marauders ${demandedFood} food. They left peacefully. Marauder reputation increased.`, 'log-event');
                            } else {
                                logMessage(`You tried to pay, but didn't have enough food. The Marauders were displeased.`, 'log-danger');
                                marauderFaction.reputation = Math.max(0, marauderFaction.reputation - 5);
                            }
                        }
                    },
                    {
                        text: "Refuse!",
                        action: () => {
                            logMessage("You refused The Marauders' demands! They are furious. 😡", 'log-danger');
                            marauderFaction.reputation = Math.max(0, marauderFaction.reputation - 15);
                        }
                    }
                ]
            );
        }
    },
    {
        name: "New Survivor Sighting",
        chance: 0.07,
        execute: (logMessage, gameState, createRandomSurvivor, checkAchievements, updateUI) => { // Pass necessary functions
            if (gameState.survivors.length < gameState.maxSurvivors) {
                const newSurvivor = createRandomSurvivor(gameState.day); // Pass current day
                gameState.survivors.push(newSurvivor);
                gameState.totalSurvivorsRecruited++; // Increment total recruited
                logMessage(`A lone survivor, ${newSurvivor.name} (${newSurvivor.trait.name}), was spotted nearby and joined your group! Welcome! 🎉`, 'log-success');
                checkAchievements(); // Check achievements after recruiting
                updateUI(); // Update UI to reflect new survivor
            } else {
                logMessage(`A lone survivor was spotted, but your fort is at max capacity. They moved on. 😔`, 'log-generic');
            }
        }
    },
    {
        name: "Nomad Caravan Sighted! 🤝",
        chance: 0.04,
        execute: (logMessage, gameState, showEventChoiceModal) => {
            const nomadFaction = gameState.factions.find(f => f.id === 'nomads');
            const offerMaterials = Math.floor(Math.random() * 8) + 5;
            const costFood = Math.floor(offerMaterials / 2); // Base cost
            showEventChoiceModal(
                "Nomad Caravan Sighted! 🤝",
                `A Nomad caravan is passing by, offering ${offerMaterials} materials for ${costFood} food. Trade? (Nomad Reputation: ${nomadFaction.reputation})`,
                [
                    {
                        text: `Trade (${costFood} Food for ${offerMaterials} Materials)`,
                        action: () => {
                            if (gameState.food >= costFood) {
                                gameState.food -= costFood;
                                gameState.materials += offerMaterials;
                                nomadFaction.reputation = Math.min(100, nomadFaction.reputation + 5);
                                logMessage(`You traded with The Nomads! Gained ${offerMaterials} materials. Nomad reputation increased.`, 'log-resource');
                            } else {
                                logMessage(`You couldn't afford to trade with The Nomads. They moved on.`, 'log-generic');
                            }
                        }
                    },
                    {
                        text: "Decline",
                        action: () => {
                            logMessage("You declined to trade with The Nomads. They moved on.", 'log-generic');
                        }
                    }
                ]
            );
        }
    },
    {
        name: "Survivor Conflict 😡",
        chance: 0.03,
        execute: (logMessage, gameState, showEventChoiceModal) => {
            if (gameState.survivors.length >= 2) {
                const s1 = gameState.survivors[Math.floor(Math.random() * gameState.survivors.length)];
                let s2 = gameState.survivors[Math.floor(Math.random() * gameState.survivors.length)];
                while (s1.id === s2.id) {
                    s2 = gameState.survivors[Math.floor(Math.random() * gameState.survivors.length)];
                }
                showEventChoiceModal(
                    "Survivor Conflict! 😡",
                    `${s1.name} and ${s2.name} are arguing loudly. Their morale is dropping. How do you handle it?`,
                    [
                        {
                            text: "Intervene & Mediate",
                            action: () => {
                                s1.morale = Math.min(100, s1.morale + 10);
                                s2.morale = Math.min(100, s2.morale + 10);
                                logMessage(`You successfully mediated the conflict between ${s1.name} and ${s2.name}. Their morale improved.`, 'log-success');
                            }
                        },
                        {
                            text: "Let them sort it out",
                            action: () => {
                                s1.morale = Math.max(0, s1.morale - 15);
                                s2.morale = Math.max(0, s2.morale - 15);
                                logMessage(`You let ${s1.name} and ${s2.name} sort out their differences. Their morale dropped.`, 'log-danger');
                            }
                        }
                    ]
                );
            }
        }
    },
    {
        name: "Marauder Scouting Party 🕵️‍♂️",
        chance: 0.04,
        execute: (logMessage, gameState, showEventChoiceModal, getSurvivorSkill, getSurvivorDefense) => {
            const marauderFaction = gameState.factions.find(f => f.id === 'marauders');
            showEventChoiceModal(
                "Marauder Scouting Party Sighted! 🕵️‍♂️",
                "A small group of Marauders is scouting near your perimeter. What's your move?",
                [
                    {
                        text: "Hide & Observe",
                        action: () => {
                            logMessage("You ordered your survivors to hide. The Marauders passed by without incident.", 'log-generic');
                        }
                    },
                    {
                        text: "Confront them (Risky!)",
                        action: () => {
                            const availableSurvivors = gameState.survivors.filter(s => !s.isBusy && !s.isSick);
                            if (availableSurvivors.length > 0) {
                                const combatPower = availableSurvivors.reduce((sum, s) => sum + getSurvivorSkill(s, 'clearing') + getSurvivorDefense(s), 0);
                                if (combatPower > 5 + (Math.random() * 5)) {
                                    gameState.materials += 5;
                                    marauderFaction.reputation = Math.max(0, marauderFaction.reputation - 5);
                                    logMessage(`You confronted the Marauders and drove them off! Gained 5 materials. Marauder reputation slightly decreased.`, 'log-success');
                                } else {
                                    const injuredSurvivor = availableSurvivors[Math.floor(Math.random() * availableSurvivors.length)];
                                    injuredSurvivor.health = Math.max(0, injuredSurvivor.health - 25);
                                    injuredSurvivor.isSick = true;
                                    logMessage(`You confronted the Marauders, but it didn't go well. ${injuredSurvivor.name} was injured!`, 'log-danger');
                                    marauderFaction.reputation = Math.min(100, marauderFaction.reputation + 5);
                                }
                            } else {
                                logMessage("No available survivors to confront them. You had to hide.", 'log-generic');
                            }
                        }
                    }
                ]
            );
        }
    }
];
