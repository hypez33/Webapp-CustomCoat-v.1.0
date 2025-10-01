
// Cannabis Idle Farm - reworked gameplay
(function(){
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const fmt = n => (n >= 1e12 ? (n/1e12).toFixed(2)+'T' :
                    n >= 1e9  ? (n/1e9 ).toFixed(2)+'B' :
                    n >= 1e6  ? (n/1e6 ).toFixed(2)+'M' :
                    n >= 1e3  ? (n/1e3 ).toFixed(2)+'k' :
                    n.toFixed(2));
  const fmtMoney = n => 'EUR ' + fmt(n);
  const formatTimer = sec => {
    if(!isFinite(sec)) return '--:--';
    if(sec <= 0) return 'bereit';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  const STAGE_LABELS = ['Keimphase', 'Vegetativ', 'Vorbluete', 'Bluete', 'Finish'];

  const STRAINS = [
    { id:'gelato', name:'Green Gelato', tag:'🍃', cost:50, yield:50, grow:120, desc:'Schnell und aromatisch', base:'assets/plants&greengelato', stages:['wachstum0','wachstum1','wachstum2','wachstum3','wachstum4','ende'] },
    { id:'zushi',  name:'Blue Zushi',   tag:'💙', cost:320, yield:90, grow:180, desc:'Frischer Hybrid' },
    { id:'honey',  name:'Honey Cream',  tag:'🍯', cost:540, yield:150, grow:210, desc:'Cremige Indica' },
    { id:'amnesia',name:'Amnesia Haze', tag:'⚡', cost:900, yield:240, grow:260, desc:'Klassische Sativa' },
    { id:'gorilla',name:'Gorilla Glue', tag:'🦍', cost:1500, yield:360, grow:320, desc:'Harzige Power' },
    { id:'zkittle',name:'Zkittlez',     tag:'🍬', cost:2300, yield:520, grow:360, desc:'Suesser Regenbogen' },
  ];

  const GLOBAL_UPGRADES = [
    { id:'lights', name:'LED-Growlights', baseCost:100, inc:0.15, desc:'Alle Pflanzen +15% Ertrag je Stufe' },
    { id:'nutrients', name:'Naehrstoff-Booster', baseCost:250, inc:0.20, desc:'Alle Pflanzen +20% je Stufe' },
    { id:'climate', name:'Klimasteuerung', baseCost:800, inc:0.35, desc:'Alle Pflanzen +35% je Stufe' },
    { id:'automation', name:'Automatisierung', baseCost:2500, inc:0.50, desc:'Alle Pflanzen +50% je Stufe' },
  ];

  const ITEMS = [
    { id:'shears', name:'Schere', icon:'SC', cost:80, desc:'Zum Ernten erforderlich', effects:{} },
    { id:'watering_can', name:'Giesskanne', icon:'WC', cost:60, desc:'Zum Waessern erforderlich', effects:{} },
    { id:'nutrients', name:'Duenger-Set', icon:'DN', cost:110, desc:'Zum Fuettern erforderlich', effects:{} },
    { id:'scale', name:'Praezisionswaage', icon:'SW', cost:150, desc:'+5% Verkaufspreis', effects:{ priceMult:1.05 } },
    { id:'jars', name:'Curing-Glaeser', icon:'JG', cost:300, desc:'+10% Verkaufspreis', effects:{ priceMult:1.10 } },
    { id:'van', name:'Lieferwagen', icon:'LV', cost:600, desc:'+1 Anfrage, -10s Spawn', effects:{ offerSlot:1, spawnDelta:10 } },
    { id:'trimmer', name:'Trimmer', icon:'TR', cost:500, desc:'+5% Pflanzenertrag', effects:{ yieldMult:1.05 } },
    { id:'filter', name:'Carbon-Filter', icon:'CF', cost:350, desc:'+5% Pflanzenertrag', effects:{ yieldMult:1.05 } },
    { id:'fan', name:'Ventilator', icon:'VF', cost:220, desc:'Reduziert Schimmelrisiko', effects:{ pestReduce:{ mold:0.6 } } },
    { id:'dehumidifier', name:'Entfeuchter', icon:'DH', cost:280, desc:'Reduziert Feuchte & Schimmel', effects:{ pestReduce:{ mold:0.5 } } },
    { id:'sticky_traps', name:'Gelbtafeln', icon:'GT', cost:120, desc:'Reduziert Thripse', effects:{ pestReduce:{ thrips:0.5 } } },
  ];

  // Research (Forschungsbaum)
  const RESEARCH_NODES = [
    { id:'bio1', name:'Botanik I', desc:'+10% Ertrag', cost:1, group:'yield', value:0.10, requires:[] },
    { id:'bio2', name:'Botanik II', desc:'+10% Ertrag', cost:2, group:'yield', value:0.10, requires:['bio1'] },
    { id:'climate1', name:'Klima I', desc:'+10% Wachstum', cost:1, group:'growth', value:0.10, requires:[] },
    { id:'process1', name:'Verarbeitung I', desc:'+10% Qualität', cost:1, group:'quality', value:0.10, requires:[] },
    { id:'auto1', name:'Automatisierung I', desc:'-20% Wasserverbrauch', cost:1, group:'water', value:0.20, requires:[] },
    { id:'pest1', name:'Schädlingskontrolle I', desc:'-25% Befallsrisiko', cost:1, group:'pest', value:0.25, requires:[] },
  ];

  // Pests
  const PESTS = [
    { id:'mites', name:'Spinnmilben', icon:'🕷️', base: 0.02, effect:{ growth:0.6, health:-2, quality:-0.01 }, prefers:'dry' },
    { id:'mold',  name:'Schimmel',    icon:'🦠', base: 0.015, effect:{ growth:0.3, health:-3, quality:-0.03 }, prefers:'wet' },
    { id:'thrips',name:'Thripse',     icon:'🦟', base: 0.018, effect:{ growth:0.8, health:-1, quality:-0.008 }, prefers:'any' },
  ];

  const MAX_SLOTS = 12;
  const SAVE_KEY = 'cannabis_idle_farm_v2';
  const BASE_PRICE_PER_G = 2;
  const OFFER_SPAWN_MIN = 45;
  const OFFER_SPAWN_MAX = 90;
  const MAX_ACTIVE_OFFERS_BASE = 3;

  const WATER_MAX = 100;
  const WATER_START = 55;
  const WATER_DRAIN_PER_SEC = 0.6;
  const WATER_ADD_AMOUNT = 55;

  const NUTRIENT_MAX = 100;
  const NUTRIENT_START = 60;
  const NUTRIENT_DRAIN_PER_SEC = 0.35;
  const NUTRIENT_ADD_AMOUNT = 45;

  const HEALTH_DECAY_DRY = 6;
  const HEALTH_DECAY_HUNGRY = 4;
  const HEALTH_RECOVER_RATE = 2;
  const QUALITY_GAIN_GOOD = 0.03;
  const QUALITY_LOSS_BAD = 0.06;
  const READY_DECAY_DELAY = 45;

  const WATER_CONSUMABLE_PRICE = 5;
  const NUTRIENT_CONSUMABLE_PRICE = 7;

  // Difficulties
  const DIFFICULTIES = {
    easy:   { name:'Leicht', growth: 1.35, pest: 0.7 },
    normal: { name:'Normal', growth: 1.15, pest: 1.0 },
    hard:   { name:'Schwer', growth: 0.95, pest: 1.4 },
  };

  let state = {
    grams:0,
    totalEarned:0,
    bestPerSec:0,
    hazePoints:0,
    resets:0,
    playtimeSec:0,
    lastTime: Date.now(),
    slotsUnlocked:3,
    plants:[],
    purchasedCount:{},
    upgrades:{},
    theme:'dark',
    cash:0,
    totalCashEarned:0,
    tradesDone:0,
    offers:[],
    nextOfferIn:10,
    itemsOwned:{},
    consumables:{ water:0, nutrient:0, spray:0, fungicide:0, beneficials:0 },
    difficulty:'normal',
    marketMult:1,
    marketTimer:0,
    // Research + Orders + Quality pool
    research:{},
    reputation:0,
    orders:[],
    nextOrderIn:60,
    qualityPool:{ grams:0, weighted:0 },
    welcomeRewarded:false
  };

  function getStrain(id){
    return STRAINS.find(s => s.id === id) || STRAINS[0];
  }

  function createPlant(strainId, slot){
    return {
      slot,
      strainId,
      level:1,
      growProg:0,
      water:WATER_START,
      nutrients:NUTRIENT_START,
      health:100,
      quality:1,
      readyTime:0
    };
  }

  function ensurePlantDefaults(plant){
    if(!plant) return;
    if(typeof plant.level !== 'number') plant.level = 1;
    if(typeof plant.growProg !== 'number' || Number.isNaN(plant.growProg)) plant.growProg = 0;
    plant.growProg = clamp(plant.growProg, 0, 1);
    if(typeof plant.water !== 'number' || Number.isNaN(plant.water)) plant.water = WATER_START;
    plant.water = clamp(plant.water, 0, WATER_MAX);
    if(typeof plant.nutrients !== 'number' || Number.isNaN(plant.nutrients)) plant.nutrients = NUTRIENT_START;
    plant.nutrients = clamp(plant.nutrients, 0, NUTRIENT_MAX);
    if(typeof plant.health !== 'number' || Number.isNaN(plant.health)) plant.health = 100;
    plant.health = clamp(plant.health, 0, 100);
    if(typeof plant.quality !== 'number' || Number.isNaN(plant.quality)) plant.quality = 1;
    plant.quality = clamp(plant.quality, 0.4, 1.5);
    if(typeof plant.readyTime !== 'number' || Number.isNaN(plant.readyTime)) plant.readyTime = 0;
    if(!plant.pest) plant.pest = null;
  }

  function ensureConsumables(){
    if(!state.consumables) state.consumables = { water:0, nutrient:0, spray:0, fungicide:0, beneficials:0 };
    if(typeof state.consumables.water !== 'number' || Number.isNaN(state.consumables.water)) state.consumables.water = 0;
    if(typeof state.consumables.nutrient !== 'number' || Number.isNaN(state.consumables.nutrient)) state.consumables.nutrient = 0;
    if(typeof state.consumables.spray !== 'number' || Number.isNaN(state.consumables.spray)) state.consumables.spray = 0;
    if(typeof state.consumables.fungicide !== 'number' || Number.isNaN(state.consumables.fungicide)) state.consumables.fungicide = 0;
    if(typeof state.consumables.beneficials !== 'number' || Number.isNaN(state.consumables.beneficials)) state.consumables.beneficials = 0;
    state.consumables.water = Math.max(0, Math.floor(state.consumables.water));
    state.consumables.nutrient = Math.max(0, Math.floor(state.consumables.nutrient));
    state.consumables.spray = Math.max(0, Math.floor(state.consumables.spray));
    state.consumables.fungicide = Math.max(0, Math.floor(state.consumables.fungicide));
    state.consumables.beneficials = Math.max(0, Math.floor(state.consumables.beneficials));
  }

  function slotUnlockCost(current){
    return Math.round(100 * Math.pow(1.75, Math.max(0, current - 1)));
  }

  function itemPriceMultiplier(){
    let mult = 1;
    for(const it of ITEMS){
      const owned = state.itemsOwned[it.id] || 0;
      if(!owned) continue;
      if(it.effects.priceMult) mult *= Math.pow(it.effects.priceMult, owned);
    }
    return mult;
  }

  function itemYieldMultiplier(){
    let mult = 1;
    for(const it of ITEMS){
      const owned = state.itemsOwned[it.id] || 0;
      if(!owned) continue;
      if(it.effects.yieldMult) mult *= Math.pow(it.effects.yieldMult, owned);
    }
    return mult;
  }

  function currentMaxOffers(){
    const extra = state.itemsOwned['van'] || 0;
    return MAX_ACTIVE_OFFERS_BASE + extra;
  }

  function currentSpawnWindow(){
    const delta = (state.itemsOwned['van'] || 0) * 10;
    return [Math.max(20, OFFER_SPAWN_MIN - delta), Math.max(25, OFFER_SPAWN_MAX - delta)];
  }

  function globalMultiplier(){
    let mult = 1;
    for(const up of GLOBAL_UPGRADES){
      const lvl = state.upgrades[up.id] || 0;
      if(lvl > 0) mult *= Math.pow(1 + up.inc, lvl);
    }
    mult *= itemYieldMultiplier();
    mult *= 1 + 0.05 * Math.sqrt(state.hazePoints || 0);
    return mult;
  }

  function harvestYieldFor(plant){
    const strain = getStrain(plant.strainId);
    const base = strain.yield || 10;
    const levelMult = Math.pow(1.12, Math.max(0, plant.level - 1));
    const res = researchEffects();
    return base * levelMult * (1 + (res.yield||0)) * globalMultiplier();
  }

  function growTimeFor(plant){
    const strain = getStrain(plant.strainId);
    return strain.grow || 180;
  }

  function qualityMultiplier(plant){
    const q = clamp(plant.quality || 1, 0.4, 1.5);
    const healthFactor = clamp((plant.health || 100)/100, 0.4, 1.1);
    const res = researchEffects();
    return q * (1 + (res.quality||0)) * healthFactor;
  }

  function timerForPlant(plant){
    if(plant.growProg >= 1) return 0;
    return Math.max(0, growTimeFor(plant) * (1 - plant.growProg));
  }

  function stageImagesFor(strain){
    if(strain && Array.isArray(strain.stages) && strain.stages.length > 0) return strain.stages;
    return ['phase-1','phase-2','phase-3','phase-4','phase-5','phase-6'];
  }

  function stageIndexFor(plant, stages){
    if(plant.growProg >= 1) return stages.length - 1;
    return Math.min(stages.length - 2, Math.floor(plant.growProg * (stages.length - 1)));
  }

  function statusForPlant(plant){
    const statuses = [];
    if(plant.growProg >= 1){
      statuses.push('Erntebereit');
    }else{
      const idx = Math.min(STAGE_LABELS.length - 1, Math.floor(plant.growProg * STAGE_LABELS.length));
      statuses.push(STAGE_LABELS[idx]);
    }
    if(plant.water < 25) statuses.push('Durstig');
    else if(plant.water > 90) statuses.push('Zu nass');
    if(plant.nutrients < 25) statuses.push('Braucht Duenger');
    if(plant.health < 45) statuses.push('Stress');
    if(statuses.length === 0) statuses.push('Stabil');
    return statuses.join(' · ');
  }

  function qualityLabel(value){
    const q = clamp(value || 1, 0, 2);
    if(q >= 1.35) return 'Top Shelf';
    if(q >= 1.15) return 'Premium';
    if(q >= 0.95) return 'Standard';
    if(q >= 0.75) return 'Mittel';
    return 'Schwach';
  }

  function setPlantMedia(card, plant){
    const img = card.querySelector('[data-phase-img]');
    const fallback = card.querySelector('[data-media-fallback]');
    if(!img || !fallback) return;
    const strain = getStrain(plant.strainId);
    const stages = stageImagesFor(strain);
    const idx = stageIndexFor(plant, stages);
    const base = strain.base || `assets/strains/${strain.id}`;
    const path = `${base}/${stages[idx]}.png`;
    img.onload = () => {
      img.style.display = 'block';
      fallback.style.display = 'none';
    };
    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'grid';
    };
    img.src = path;
  }

    function updatePlantCard(card, plant){
    if(!card) return;
    const timerEl = card.querySelector('[data-timer]');
    if(timerEl) timerEl.textContent = formatTimer(timerForPlant(plant));
    const healthEl = card.querySelector('[data-health]');
    if(healthEl) healthEl.textContent = `${Math.round(plant.health)}%`;
    const statusEl = card.querySelector('[data-status]');
    if(statusEl) statusEl.textContent = statusForPlant(plant);
    const qualityEl = card.querySelector('[data-quality]');
    if(qualityEl) qualityEl.textContent = qualityLabel(plant.quality);
    const yieldEl = card.querySelector('[data-yield]');
    if(yieldEl) yieldEl.textContent = Math.round(harvestYieldFor(plant) * qualityMultiplier(plant));
    const levelEl = card.querySelector('[data-level]');
    if(levelEl) levelEl.textContent = plant.level;
    const upgCostEl = card.querySelector('[data-upgrade-cost]');
    if(upgCostEl) upgCostEl.textContent = fmt(plantUpgradeCost(plant));
    const growthBar = card.querySelector('[data-progress]');
    if(growthBar) growthBar.style.width = `${(plant.growProg * 100).toFixed(1)}%`;
    const waterBar = card.querySelector('[data-water]');
    if(waterBar) waterBar.style.width = `${Math.round((plant.water / WATER_MAX) * 100)}%`;
    const nutrientBar = card.querySelector('[data-nutrient]');
    if(nutrientBar) nutrientBar.style.width = `${Math.round((plant.nutrients / NUTRIENT_MAX) * 100)}%`;
    const pestBadge = card.querySelector('[data-pest]');
    if(plant.pest){
      const pest = PESTS.find(p => p.id === plant.pest.id) || {icon:'🐛', name:'Schaedlinge'};
      const sev = Math.round((plant.pest.sev || 1) * 100);
      if(pestBadge){ pestBadge.textContent = pest.icon + ' ' + pest.name + ' (' + sev + '%)'; pestBadge.title = 'Befallen'; }
      card.classList.add('card-alert');
    } else {
      if(pestBadge){ pestBadge.textContent = ''; pestBadge.title = 'Gesund'; }
      card.classList.remove('card-alert');
    }
    setPlantMedia(card, plant);
    setActionStates(card, plant);
  }function plantUpgradeCost(plant){
    const strain = getStrain(plant.strainId);
    return Math.round(strain.cost * Math.pow(1.15, plant.level));
  }

  function strainPurchaseCost(strainId){
    const strain = getStrain(strainId);
    const count = state.purchasedCount[strainId] || 0;
    return Math.round(strain.cost * Math.pow(1.18, count));
  }

  function computePerSec(){
    return state.plants.reduce((sum, plant) => {
      ensurePlantDefaults(plant);
      if(plant.growProg >= 1 || plant.health <= 0) return sum;
      const slow = (plant.water <= 0 || plant.nutrients <= 0) ? 0.25 : 1;
      const d = DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
      const effTime = growTimeFor(plant) / (d.growth || 1);
      return sum + (harvestYieldFor(plant) * qualityMultiplier(plant) / effTime) * slow;
    }, 0);
  }

  function save(){
    state.lastTime = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function load(){
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    try{
      const loaded = JSON.parse(raw);
      state = Object.assign({}, state, loaded);
      state.plants = Array.isArray(loaded.plants) ? loaded.plants : [];
      state.purchasedCount = loaded.purchasedCount || {};
      state.upgrades = loaded.upgrades || {};
      state.offers = Array.isArray(loaded.offers) ? loaded.offers : [];
      state.itemsOwned = loaded.itemsOwned || {};
      state.theme = loaded.theme || 'dark';
      state.consumables = loaded.consumables || { water:0, nutrient:0 };
      state.difficulty = loaded.difficulty || state.difficulty || 'normal';
      state.research = loaded.research || {};
      state.reputation = loaded.reputation || 0;
      state.orders = Array.isArray(loaded.orders) ? loaded.orders : [];
      state.nextOrderIn = typeof loaded.nextOrderIn === 'number' ? loaded.nextOrderIn : 60;
      state.qualityPool = loaded.qualityPool || { grams:0, weighted:0 };
      ensureConsumables();
      state.plants.forEach(ensurePlantDefaults);
    }catch(err){
      console.warn('Save konnte nicht gelesen werden', err);
    }
  }

  function advancePlant(plant, delta){
    ensurePlantDefaults(plant);
    let remaining = delta;
    const growTime = growTimeFor(plant);
    while(remaining > 0){
      const step = Math.min(remaining, 1);
      const res = researchEffects();
      plant.water = clamp(plant.water - WATER_DRAIN_PER_SEC * (1 - (res.water||0)) * step, 0, WATER_MAX);
      plant.nutrients = clamp(plant.nutrients - NUTRIENT_DRAIN_PER_SEC * step, 0, NUTRIENT_MAX);

      const waterRatio = plant.water / WATER_MAX;
      const nutrientRatio = plant.nutrients / NUTRIENT_MAX;
      const goodWater = waterRatio >= 0.4 && waterRatio <= 0.85;
      const goodNutrient = nutrientRatio >= 0.4 && nutrientRatio <= 0.8;

      const d = DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
      let growthFactor = d.growth;
      let healthDelta = 0;
      let qualityDelta = 0;

      if(plant.water <= 0){
        healthDelta -= HEALTH_DECAY_DRY * step;
        qualityDelta -= QUALITY_LOSS_BAD * step;
        growthFactor *= 0.05;
      }else if(waterRatio < 0.25){
        healthDelta -= (HEALTH_DECAY_DRY/2) * step;
        qualityDelta -= (QUALITY_LOSS_BAD/2) * step;
        growthFactor *= 0.35;
      }else if(waterRatio > 0.9){
        qualityDelta -= 0.02 * step;
        growthFactor *= 0.8;
      }else if(goodWater){
        qualityDelta += QUALITY_GAIN_GOOD * step;
        healthDelta += HEALTH_RECOVER_RATE * 0.3 * step;
      }

      if(plant.nutrients <= 0){
        healthDelta -= HEALTH_DECAY_HUNGRY * step;
        qualityDelta -= QUALITY_LOSS_BAD * step;
        growthFactor *= 0.25;
      }else if(nutrientRatio < 0.3){
        healthDelta -= (HEALTH_DECAY_HUNGRY/2) * step;
        qualityDelta -= (QUALITY_LOSS_BAD/2) * step;
        growthFactor *= 0.5;
      }else if(nutrientRatio > 0.9){
        qualityDelta -= 0.015 * step;
      }else if(goodNutrient){
        qualityDelta += QUALITY_GAIN_GOOD * 0.8 * step;
      }

      if(plant.health < 40) growthFactor *= 0.6;

      // Pests: increase severity over time and apply penalties
      if(!plant.pest){
        maybeSpawnPestFor(plant, step, waterRatio, nutrientRatio);
      } else {
        const pestDef = PESTS.find(p=>p.id===plant.pest.id) || PESTS[0];
        const sev = plant.pest.sev || 1; // 1..3 scale
        growthFactor *= Math.max(0.2, (pestDef.effect.growth || 1));
        healthDelta += (pestDef.effect.health || 0) * (0.5 + 0.5*sev) * step;
        qualityDelta += (pestDef.effect.quality || 0) * (0.5 + 0.5*sev) * step;
        plant.pest.sev = Math.min(3, sev + 0.04 * step);
      }
      if(plant.health > 85 && goodWater && goodNutrient) growthFactor *= 1.1;

      if(plant.growProg < 1){
        plant.growProg = clamp(plant.growProg + (step / growTime) * growthFactor, 0, 1);
        if(plant.growProg >= 1) plant.readyTime = 0;
      }else{
        plant.readyTime = (plant.readyTime || 0) + step;
        if(plant.readyTime > READY_DECAY_DELAY){
          qualityDelta -= (QUALITY_LOSS_BAD/2) * step;
        }
      }

      if(goodWater && goodNutrient && plant.growProg < 1 && plant.health > 50){
        healthDelta += HEALTH_RECOVER_RATE * step;
      }

      plant.health = clamp(plant.health + healthDelta, 0, 100);
      plant.quality = clamp(plant.quality + qualityDelta, 0.4, 1.5);

      if(plant.health <= 0){
        plant.health = 0;
        plant.growProg = Math.min(plant.growProg, 0.1);
        break;
      }

      remaining -= step;
    }
  }

  function maybeSpawnPestFor(plant, dt, waterRatio, nutrientRatio){
    // base risk modified by conditions and owned items
    const d = DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
    const mods = pestRiskModifiers();
    for(const pest of PESTS){
      let risk = pest.base * dt * (d.pest || 1); // per second base
      if(pest.prefers === 'dry' && waterRatio < 0.35) risk *= 3;
      if(pest.prefers === 'wet' && waterRatio > 0.85) risk *= 3.5;
      if(nutrientRatio < 0.25) risk *= 1.3;
      if(mods[pest.id]) risk *= mods[pest.id];
      if(Math.random() < risk){
        plant.pest = { id: pest.id, sev: 1 };
        break;
      }
    }
  }

  function pestRiskModifiers(){
    const m = { mites:1, mold:1, thrips:1 };
    for(const it of ITEMS){
      const own = state.itemsOwned[it.id] || 0;
      if(!own || !it.effects || !it.effects.pestReduce) continue;
      for(const key of Object.keys(it.effects.pestReduce)){
        m[key] = m[key] * Math.pow(it.effects.pestReduce[key], own);
      }
    }
    return m;
  }

  function applyOfflineProgress(){
    const now = Date.now();
    const elapsed = Math.max(0, (now - state.lastTime) / 1000);
    if(elapsed < 1) return;
    for(const plant of state.plants){
      advancePlant(plant, elapsed);
    }
  }

  const slotsEl = $('#slots');
  const unlockBtn = $('#unlockSlotBtn');
  const unlockCostEl = $('#unlockCost');
  const slotCountEl = $('#slotCount');
  const slotMaxEl = $('#slotMax');
  const gramsEls = [$('#grams'), $('#gramsBig')];
  const perSecEls = [$('#perSec'), $('#perSecBig')];
  const cashEl = $('#cash');
  const prestigeEls = {
    points: $('#prestigePoints'),
    owned: $('#prestigeOwned'),
    gain: $('#prestigeGain'),
    bonus: $('#prestigeBonus')
  };
  const lifetimeEl = $('#lifetimeTotal');
  const bestPerSecEl = $('#bestPerSec');
  const plantCountEl = $('#plantCount');
  const playtimeEl = $('#playtime');
  const resetCountEl = $('#resetCount');
  const shopEl = $('#shop');
  const upgListEl = $('#globalUpgrades');
  const themeToggle = $('#themeToggle');
  const toastEl = $('#toast');
  const basePriceEl = $('#basePrice');
  const saleMultEl = $('#saleMult');
  const effectivePriceEl = $('#effectivePrice');
  const sell10Btn = $('#sell10');
  const sell100Btn = $('#sell100');
  const sellMaxBtn = $('#sellMax');
  const offerListEl = $('#offerList');
  const itemShopEl = $('#itemShop');
  const inventoryEl = $('#inventoryList');
  const waterChargesEl = $('#waterCharges');
  const nutrientChargesEl = $('#nutrientCharges');
  const buyWaterBtn = $('#buyWater');
  const buyNutrientBtn = $('#buyNutrient');
  const sprayChargesEl = $('#sprayCharges');
  const fungicideChargesEl = $('#fungicideCharges');
  const beneficialChargesEl = $('#beneficialCharges');
  const buySprayBtn = $('#buySpray');
  const buyFungicideBtn = $('#buyFungicide');
  const buyBeneficialBtn = $('#buyBeneficial');
  const welcomeModal = $('#welcomeModal');
  const welcomeOk = $('#welcomeOk');
  // Settings
  const diffEasy = $('#diffEasy');
  const diffNormal = $('#diffNormal');
  const diffHard = $('#diffHard');
  const diffGrowth = $('#diffGrowth');
  const diffPest = $('#diffPest');

  if(slotMaxEl) slotMaxEl.textContent = MAX_SLOTS;

  function showToast(message){
    if(!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  function renderResources(){
    const gramsText = fmt(state.grams) + ' g';
    gramsEls.forEach(el => { if(el) el.textContent = gramsText; });
    const perSecText = fmt(computePerSec()) + ' g/s';
    perSecEls.forEach(el => { if(el) el.textContent = perSecText; });
    if(cashEl) cashEl.textContent = fmtMoney(state.cash);
    prestigeEls.points.textContent = String(state.hazePoints);
    renderConsumables();
  }

  function renderStats(){
    if(lifetimeEl) lifetimeEl.textContent = fmt(state.totalEarned) + ' g';
    if(bestPerSecEl) bestPerSecEl.textContent = fmt(state.bestPerSec) + ' g/s';
    if(plantCountEl) plantCountEl.textContent = String(state.plants.length);
    if(resetCountEl) resetCountEl.textContent = String(state.resets || 0);
    const sec = Math.floor(state.playtimeSec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if(playtimeEl) playtimeEl.textContent = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function renderSlots(){
    // Auto-adjust visible slots: start with 3, always keep one extra free slot up to MAX_SLOTS
    const minSlots = 3;
    const target = Math.min(MAX_SLOTS, Math.max(minSlots, (state.plants?.length || 0) + 1));
    if(state.slotsUnlocked < target) state.slotsUnlocked = target;

    slotsEl.innerHTML = '';
    const unlocked = state.slotsUnlocked;
    for(let i = 0; i < unlocked; i++){
      const plant = state.plants.find(p => p.slot === i);
      const cell = document.createElement('div');
      cell.className = 'slot';
      if(plant){
        ensurePlantDefaults(plant);
        const tpl = $('#tpl-plant-card');
        const card = tpl.content.firstElementChild.cloneNode(true);
        const strain = getStrain(plant.strainId);
        card.dataset.slot = String(i);
        card.querySelector('[data-icon]').textContent = strain.tag;
        card.querySelector('[data-name]').textContent = strain.name;
        updatePlantCard(card, plant);
        card.querySelector('[data-upgrade]').addEventListener('click', () => upgradePlant(i));
        card.querySelector('[data-remove]').addEventListener('click', () => removePlant(i));
        card.querySelector('[data-harvest]').addEventListener('click', () => harvestPlant(i));
        card.querySelector('[data-water-btn]').addEventListener('click', () => waterPlant(i));
        card.querySelector('[data-feed-btn]').addEventListener('click', () => feedPlant(i));
        const pb = card.querySelector('[data-pest-btn]');
        if(pb) pb.addEventListener('click', () => treatPlant(i));
        cell.appendChild(card);
      }else{
        cell.classList.add('center');
        const btn = document.createElement('button');
        btn.className = 'secondary';
        btn.textContent = 'Pflanze setzen';
        btn.addEventListener('click', () => openShopForSlot(i));
        const label = document.createElement('div');
        label.className = 'slot-label';
        label.textContent = `Slot ${i + 1}`;
        label.style.position = 'absolute';
        label.style.bottom = '8px';
        label.style.left = '10px';
        label.style.fontSize = '12px';
        cell.appendChild(btn);
        cell.appendChild(label);
      }
      slotsEl.appendChild(cell);
    }
    for(let i = unlocked; i < MAX_SLOTS; i++){
      const cell = document.createElement('div');
      cell.className = 'slot locked center';
      cell.textContent = 'Gesperrt';
      slotsEl.appendChild(cell);
    }
    if(slotCountEl) slotCountEl.textContent = String(unlocked);
    if(unlockCostEl) unlockCostEl.textContent = unlocked >= MAX_SLOTS ? 'max' : fmt(slotUnlockCost(unlocked));
  }

  function renderShop(selectedSlot){
    if(!shopEl) return;
    shopEl.innerHTML = '';
    for(const strain of STRAINS){
      const cost = strainPurchaseCost(strain.id);
      const card = document.createElement('div');
      card.className = 'shop-item';
      const duration = strain.grow || 180;
      const mm = Math.floor(duration / 60);
      const ss = duration % 60;
      card.innerHTML = `
        <div class="shop-left">
          <div class="shop-icon">${strain.tag}</div>
          <div>
            <div class="shop-name">${strain.name}</div>
            <div class="shop-desc">${strain.desc} · Ernte: ${Math.round(strain.yield)} g · Dauer: ${mm}:${String(ss).padStart(2,'0')}</div>
          </div>
        </div>
        <button class="accent" data-buy="${strain.id}">Kaufen (${fmtMoney(cost)})</button>
      `;
      card.querySelector('button').addEventListener('click', () => buyPlant(strain.id, selectedSlot));
      shopEl.appendChild(card);
    }
  }

  function renderUpgrades(){
    if(!upgListEl) return;
    upgListEl.innerHTML = '';
    for(const up of GLOBAL_UPGRADES){
      const lvl = state.upgrades[up.id] || 0;
      const cost = Math.round(up.baseCost * Math.pow(1.6, lvl));
      const node = document.createElement('div');
      node.className = 'upgrade';
      node.innerHTML = `
        <div class="upg-left">
          <div class="upg-name">${up.name}</div>
          <div class="upg-level">Stufe ${lvl} · Bonus +${Math.round(up.inc*100)}%</div>
          <div class="hint">${up.desc}</div>
        </div>
        <button class="secondary" data-upg="${up.id}">Kaufen (${fmt(cost)} g)</button>
      `;
      node.querySelector('button').addEventListener('click', () => buyUpgrade(up.id));
      upgListEl.appendChild(node);
    }
    const nextHaze = calcPrestigeGain(state.totalEarned);
    prestigeEls.owned.textContent = String(state.hazePoints);
    prestigeEls.gain.textContent = String(nextHaze);
    prestigeEls.bonus.textContent = 'x' + (1 + 0.05 * Math.sqrt(state.hazePoints || 0)).toFixed(2);
  }

  // Research UI under its own tab or can be reused elsewhere
  function researchAvailable(){
    // simple derivation: 1 point per 500 g lifetime + haze points
    const totalPoints = Math.floor((state.totalEarned||0) / 500) + (state.hazePoints||0);
    const spent = RESEARCH_NODES.reduce((s,n)=> s + (state.research?.[n.id] ? n.cost : 0), 0);
    return Math.max(0, totalPoints - spent);
  }

  function researchEffects(){
    const res = state.research || {};
    const eff = { yield:0, growth:0, quality:0, pest:0, water:0 };
    for(const n of RESEARCH_NODES){
      if(res[n.id]){
        if(n.group==='yield') eff.yield += n.value;
        if(n.group==='growth') eff.growth += n.value;
        if(n.group==='quality') eff.quality += n.value;
        if(n.group==='pest') eff.pest += n.value;
        if(n.group==='water') eff.water += n.value;
      }
    }
    return eff;
  }

  function renderResearch(){
    const wrap = document.getElementById('researchList');
    const availEl = document.getElementById('researchAvailable');
    if(availEl) availEl.textContent = String(researchAvailable());
    if(!wrap) return;
    wrap.innerHTML = '';
    const eff = researchEffects();
    // optional header showing totals
    const totals = document.createElement('div');
    totals.className = 'hint';
    totals.textContent = `Aktive Boni – Ertrag +${Math.round(eff.yield*100)}%, Wachstum +${Math.round(eff.growth*100)}%, Qualität +${Math.round(eff.quality*100)}%, Risiko -${Math.round(eff.pest*100)}%, Wasser -${Math.round(eff.water*100)}%`;
    wrap.appendChild(totals);
    for(const node of RESEARCH_NODES){
      const owned = !!(state.research && state.research[node.id]);
      const div = document.createElement('div');
      div.className = 'upgrade';
      const prereqOk = (node.requires||[]).every(id => state.research?.[id]);
      div.innerHTML = `
        <div class="upg-left">
          <div class="upg-name">${node.name}</div>
          <div class="upg-level">Kosten ${node.cost} · ${node.desc}</div>
          <div class="hint">${prereqOk ? '' : 'Benötigt: ' + (node.requires||[]).join(', ')}</div>
        </div>
        <button class="secondary" ${owned?'disabled':''} data-research="${node.id}">${owned?'Erforscht':'Freischalten'}</button>
      `;
      const btn = div.querySelector('button');
      if(!owned){
        btn.disabled = researchAvailable() < node.cost || !prereqOk;
        btn.addEventListener('click', () => buyResearch(node.id));
      }
      wrap.appendChild(div);
    }
  }

  function buyResearch(id){
    const node = RESEARCH_NODES.find(n=>n.id===id);
    if(!node) return;
    if(state.research?.[id]) return;
    const prereqOk = (node.requires||[]).every(r=> state.research?.[r]);
    if(!prereqOk){ showToast('Voraussetzungen fehlen.'); return; }
    if(researchAvailable() < node.cost){ showToast('Nicht genug Forschungspunkte.'); return; }
    state.research = state.research || {};
    state.research[id] = 1;
    renderResearch();
    save();
  }

  function renderTrade(){
    const base = BASE_PRICE_PER_G * (state.marketMult || 1);
    const mult = itemPriceMultiplier();
    if(basePriceEl) basePriceEl.textContent = fmtMoney(base) + '/g';
    if(saleMultEl) saleMultEl.textContent = 'x' + mult.toFixed(2);
    // Quality factor
    const avgQ = (state.qualityPool.grams||0) > 0 ? (state.qualityPool.weighted/state.qualityPool.grams) : 1;
    const qMult = saleQualityMultiplier(avgQ);
    const eff = base * mult * qMult;
    const qEl = (typeof document !== 'undefined') ? document.getElementById('qualityMult') : null;
    if(qEl) qEl.textContent = 'x' + qMult.toFixed(2);
    if(effectivePriceEl) effectivePriceEl.textContent = fmtMoney(eff) + '/g';
    if(sell10Btn) sell10Btn.disabled = state.grams < 10;
    if(sell100Btn) sell100Btn.disabled = state.grams < 100;
    if(sellMaxBtn) sellMaxBtn.disabled = state.grams < 1;
    renderOffers();
    renderOrders();
    renderItems();
    renderInventory();
    renderConsumables();
  }

  // Quality-based pricing tiers
  function saleQualityMultiplier(avgQ){
    if(!isFinite(avgQ) || avgQ<=0) return 1;
    if(avgQ >= 1.35) return 1.6;
    if(avgQ >= 1.15) return 1.25;
    return 1.0;
  }

  function renderOffers(){
    if(!offerListEl) return;
    offerListEl.innerHTML = '';
    const now = Date.now();
    state.offers = state.offers.filter(o => o.expiresAt > now);
    for(const offer of state.offers){
      const total = offer.grams * offer.pricePerG;
      const node = document.createElement('div');
      node.className = 'offer';
      node.innerHTML = `
        <div class="offer-left">
          <div class="offer-qty">${offer.grams} g</div>
          <div>
            <div>Preis: <strong>${fmtMoney(offer.pricePerG)}</strong> · Gesamt: <strong>${fmtMoney(total)}</strong></div>
            <div class="offer-meta">Anfrage #${offer.id}</div>
          </div>
        </div>
        <div class="offer-right">
          <div class="offer-timer" data-offer="${offer.id}">--s</div>
          <button class="accent" data-accept="${offer.id}">Verkaufen</button>
        </div>
      `;
      node.querySelector('[data-accept]').addEventListener('click', () => acceptOffer(offer.id));
      offerListEl.appendChild(node);
    }
  }

  function renderItems(){
    if(!itemShopEl) return;
    itemShopEl.innerHTML = '';
    for(const it of ITEMS){
      const node = document.createElement('div');
      node.className = 'shop-item';
      node.innerHTML = `
        <div class="shop-left">
          <div class="shop-icon">${it.icon}</div>
          <div>
            <div class="shop-name">${it.name}</div>
            <div class="shop-desc">${it.desc}</div>
          </div>
        </div>
        <button class="secondary" data-buy-item="${it.id}">Kaufen (${fmtMoney(it.cost)})</button>
      `;
      const btn = node.querySelector('button');
      btn.disabled = !canBuyItem(it);
      btn.addEventListener('click', () => buyItem(it.id));
      itemShopEl.appendChild(node);
    }
  }

  function renderConsumables(){
    ensureConsumables();
    if(waterChargesEl) waterChargesEl.textContent = String(state.consumables.water || 0);
    if(nutrientChargesEl) nutrientChargesEl.textContent = String(state.consumables.nutrient || 0);
    if(sprayChargesEl) sprayChargesEl.textContent = String(state.consumables.spray || 0);
    if(fungicideChargesEl) fungicideChargesEl.textContent = String(state.consumables.fungicide || 0);
    if(beneficialChargesEl) beneficialChargesEl.textContent = String(state.consumables.beneficials || 0);
    if(buyWaterBtn){
      buyWaterBtn.disabled = state.cash < WATER_CONSUMABLE_PRICE;
      buyWaterBtn.textContent = `Kaufen (€ ${WATER_CONSUMABLE_PRICE})`;
    }
    if(buyNutrientBtn){
      buyNutrientBtn.disabled = state.cash < NUTRIENT_CONSUMABLE_PRICE;
      buyNutrientBtn.textContent = `Kaufen (€ ${NUTRIENT_CONSUMABLE_PRICE})`;
    }
    if(buySprayBtn){ buySprayBtn.disabled = state.cash < 9; buySprayBtn.textContent = 'Kaufen (€ 9)'; }
    if(buyFungicideBtn){ buyFungicideBtn.disabled = state.cash < 11; buyFungicideBtn.textContent = 'Kaufen (€ 11)'; }
    if(buyBeneficialBtn){ buyBeneficialBtn.disabled = state.cash < 14; buyBeneficialBtn.textContent = 'Kaufen (€ 14)'; }
  }

  function buyConsumable(type){
    ensureConsumables();
    let price = 0;
    if(type === 'water') price = WATER_CONSUMABLE_PRICE;
    else if(type === 'nutrient') price = NUTRIENT_CONSUMABLE_PRICE;
    else if(type === 'spray') price = 9;
    else if(type === 'fungicide') price = 11;
    else if(type === 'beneficial') price = 14;
    if(state.cash < price){ showToast('Nicht genug Bargeld.'); return; }
    state.cash -= price;
    if(type === 'water') state.consumables.water += 1;
    else if(type === 'nutrient') state.consumables.nutrient += 1;
    else if(type === 'spray') state.consumables.spray += 1;
    else if(type === 'fungicide') state.consumables.fungicide += 1;
    else if(type === 'beneficial') state.consumables.beneficials += 1;
    renderResources();
    updateProgressBars();
    save();
  }

  function renderInventory(){
    if(!inventoryEl) return;
    inventoryEl.innerHTML = '';
    const owned = ITEMS.filter(it => (state.itemsOwned[it.id] || 0) > 0);
    if(owned.length === 0){
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = 'Keine Artikel vorhanden.';
      inventoryEl.appendChild(empty);
      return;
    }
    for(const it of owned){
      const qty = state.itemsOwned[it.id] || 0;
      const sellPrice = Math.round(it.cost * 0.7);
      const node = document.createElement('div');
      node.className = 'inventory-item';
      node.innerHTML = `
        <div class="shop-left">
          <div class="shop-icon">${it.icon}</div>
          <div>
            <div class="shop-name">${it.name} ${qty>1 ? 'x'+qty : ''}</div>
            <div class="shop-desc">Verkauf: ${fmtMoney(sellPrice)}</div>
          </div>
        </div>
        <button class="ghost danger" data-sell-item="${it.id}">Verkaufen</button>
      `;
      node.querySelector('button').addEventListener('click', () => sellItem(it.id));
      inventoryEl.appendChild(node);
    }
  }

  function openShopForSlot(slotIndex){
    renderShop(slotIndex);
    showToast(`Slot ${slotIndex + 1} ausgewaehlt`);
  }

  function buyPlant(strainId, slotIndex){
    if(slotIndex == null){
      const empty = firstEmptySlot();
      if(empty == null){ showToast('Kein freier Slot.'); return; }
      slotIndex = empty;
    }
    const cost = strainPurchaseCost(strainId);
    if(state.cash < cost){ showToast('Nicht genug Bargeld.'); return; }
    state.cash -= cost;
    state.purchasedCount[strainId] = (state.purchasedCount[strainId] || 0) + 1;
    state.plants = state.plants.filter(p => p.slot !== slotIndex);
    state.plants.push(createPlant(strainId, slotIndex));
    renderSlots();
    renderResources();
    save();
  }

  function removePlant(slotIndex){
    state.plants = state.plants.filter(p => p.slot !== slotIndex);
    renderSlots();
    save();
  }

  function upgradePlant(slotIndex){
    const plant = state.plants.find(p => p.slot === slotIndex);
    if(!plant) return;
    const cost = plantUpgradeCost(plant);
    if(state.grams < cost){ showToast('Nicht genug Ertrag.'); return; }
    state.grams -= cost;
    plant.level += 1;
    renderResources();
    updateProgressBars();
    save();
  }

  function harvestPlant(slotIndex){
    const plant = state.plants.find(p => p.slot === slotIndex);
    if(!plant) return;
    if(plant.growProg < 1){ showToast('Noch nicht reif.'); return; }
    if((state.itemsOwned['shears'] || 0) <= 0){ showToast('Schere erforderlich.'); return; }
    const gain = harvestYieldFor(plant) * qualityMultiplier(plant);
    state.grams += gain;
    state.totalEarned += gain;
    plant.growProg = 0;
    plant.readyTime = 0;
    plant.water = Math.max(0, plant.water - 10);
    plant.quality = clamp(plant.quality - 0.05, 0.4, 1.5);
    spawnFloat(slotIndex, `+${fmt(gain)} g`);
    spawnBurst(slotIndex, '🍃', 7);
    renderResources();
    updateProgressBars();
    save();
  }

  function waterPlant(slotIndex){
    const plant = state.plants.find(p => p.slot === slotIndex);
    if(!plant) return;
    ensureConsumables();
    if(state.consumables.water <= 0){ showToast('Kein Wasserkanister verfügbar.'); return; }
    state.consumables.water -= 1;
    plant.water = Math.min(WATER_MAX, plant.water + WATER_ADD_AMOUNT);
    updateProgressBars();
    spawnBurst(slotIndex, '💧', 4);
    renderConsumables();
    save();
  }

  function feedPlant(slotIndex){
    const plant = state.plants.find(p => p.slot === slotIndex);
    if(!plant) return;
    ensureConsumables();
    if(state.consumables.nutrient <= 0){ showToast('Kein Düngerpaket verfügbar.'); return; }
    state.consumables.nutrient -= 1;
    plant.nutrients = Math.min(NUTRIENT_MAX, plant.nutrients + NUTRIENT_ADD_AMOUNT);
    plant.quality = clamp(plant.quality + 0.04, 0.4, 1.5);
    updateProgressBars();
    spawnBurst(slotIndex, '🧪', 4);
    renderConsumables();
    save();
  }

  function treatPlant(slotIndex){
    const plant = state.plants.find(p => p.slot === slotIndex);
    if(!plant || !plant.pest){ showToast('Keine Schädlinge vorhanden.'); return; }
    ensureConsumables();
    const type = plant.pest.id;
    if(type === 'mold'){
      if(state.consumables.fungicide > 0){
        state.consumables.fungicide -= 1;
        plant.pest = null;
        spawnBurst(slotIndex, '🛡️', 6);
      } else { showToast('Fungizid benötigt.'); return; }
    } else if(type === 'mites' || type === 'thrips'){
      if(state.consumables.spray > 0){
        state.consumables.spray -= 1;
        plant.pest = null;
        spawnBurst(slotIndex, '🛡️', 6);
      } else if(state.consumables.beneficials > 0){
        state.consumables.beneficials -= 1;
        plant.pest = null;
        spawnBurst(slotIndex, '🪲', 6);
      } else { showToast('Keine Abwehr vorhanden.'); return; }
    }
    updateProgressBars();
    renderConsumables();
    save();
  }

  function firstEmptySlot(){
    const used = new Set(state.plants.map(p => p.slot));
    for(let i = 0; i < state.slotsUnlocked; i++){
      if(!used.has(i)) return i;
    }
    return null;
  }

  function unlockSlot(){
    if(state.slotsUnlocked >= MAX_SLOTS){ showToast('Alle Slots frei.'); return; }
    const cost = slotUnlockCost(state.slotsUnlocked);
    if(state.grams < cost){ showToast('Nicht genug Ertrag.'); return; }
    state.grams -= cost;
    state.slotsUnlocked += 1;
    renderSlots();
    renderResources();
    save();
  }

  function buyUpgrade(id){
    const def = GLOBAL_UPGRADES.find(u => u.id === id);
    if(!def) return;
    const lvl = state.upgrades[id] || 0;
    const cost = Math.round(def.baseCost * Math.pow(1.6, lvl));
    if(state.grams < cost){ showToast('Nicht genug Ertrag.'); return; }
    state.grams -= cost;
    state.upgrades[id] = lvl + 1;
    renderUpgrades();
    renderResources();
    save();
  }

  function quickSell(amount){
    amount = Math.floor(amount);
    if(amount <= 0) return;
    if(state.grams < amount){ showToast('Nicht genug Ertrag.'); return; }
    const price = BASE_PRICE_PER_G * itemPriceMultiplier();
    const cashGain = amount * price;
    state.grams -= amount;
    state.cash += cashGain;
    state.totalCashEarned += cashGain;
    state.tradesDone += 1;
    renderResources();
    renderTrade();
    save();
    showToast(`Verkauft: ${amount} g fuer ${fmtMoney(cashGain)}`);
  }

  function canBuyItem(it){
    if(!it.stack && (state.itemsOwned[it.id] || 0) >= 1) return false;
    return state.cash >= it.cost;
  }

  function buyItem(id){
    const it = ITEMS.find(item => item.id === id);
    if(!it) return;
    if(!canBuyItem(it)){ showToast('Nicht genug Bargeld oder bereits vorhanden.'); return; }
    state.cash -= it.cost;
    state.itemsOwned[id] = (state.itemsOwned[id] || 0) + 1;
    renderResources();
    renderTrade();
    save();
  }

  function sellItem(id){
    const it = ITEMS.find(item => item.id === id);
    if(!it) return;
    const owned = state.itemsOwned[id] || 0;
    if(owned <= 0) return;
    state.itemsOwned[id] = owned - 1;
    const price = Math.round(it.cost * 0.7);
    state.cash += price;
    renderResources();
    renderTrade();
    save();
  }

  function spawnOffer(){
    const scale = Math.max(1, Math.sqrt(Math.max(1, state.totalEarned)) / 20);
    const grams = clamp(Math.floor(40 * scale + Math.random() * (400 * scale)), 20, 1000000);
    const priceMult = 1.1 + Math.random() * 0.9;
    const pricePerG = parseFloat((BASE_PRICE_PER_G * priceMult).toFixed(2));
    const ttl = 60 + Math.floor(Math.random() * 120);
    const id = Math.floor(Math.random() * 1e6);
    state.offers.push({ id, grams, pricePerG, expiresAt: Date.now() + ttl * 1000 });
  }

  function acceptOffer(id){
    const idx = state.offers.findIndex(o => o.id === id);
    if(idx === -1) return;
    const offer = state.offers[idx];
    if(offer.expiresAt <= Date.now()){
      state.offers.splice(idx, 1);
      renderTrade();
      return;
    }
    if(state.grams < offer.grams){ showToast('Nicht genug Ertrag fuer diese Anfrage.'); return; }
    state.grams -= offer.grams;
    const total = offer.grams * offer.pricePerG;
    state.cash += total;
    state.totalCashEarned += total;
    state.tradesDone += 1;
    state.offers.splice(idx, 1);
    renderResources();
    renderTrade();
    save();
    showToast(`Anfrage erfuellt: ${offer.grams} g fuer ${fmtMoney(total)}`);
  }

  function calcPrestigeGain(total){
    return Math.floor(Math.pow(total / 10000, 0.5));
  }

  function doPrestige(){
    const gain = calcPrestigeGain(state.totalEarned);
    if(gain <= 0){ showToast('Noch kein Prestige-Gewinn verfuegbar.'); return; }
    if(!confirm(`Reinvestieren? Du erhaeltst ${gain} Haze-Punkte und setzt die Farm zurueck.`)) return;
    const theme = state.theme;
    state = {
      grams:0,
      totalEarned:0,
      bestPerSec:0,
      hazePoints: state.hazePoints + gain,
      resets:(state.resets||0)+1,
      playtimeSec:0,
      lastTime: Date.now(),
      slotsUnlocked:3,
      plants:[],
      purchasedCount:{},
      upgrades:{},
      theme,
      cash:0,
      totalCashEarned:0,
      tradesDone:0,
      offers:[],
      nextOfferIn:10,
      itemsOwned:{},
      consumables:{ water:0, nutrient:0 },
      welcomeRewarded:true
    };
    renderAll();
    save();
    showToast('Prestige abgeschlossen. Bonus aktiv.');
  }

  function setActionStates(card, plant){
    const harvestBtn = card.querySelector('[data-harvest]');
    const waterBtn = card.querySelector('[data-water-btn]');
    const feedBtn = card.querySelector('[data-feed-btn]');
    const pestBtn = card.querySelector('[data-pest-btn]');
    const hasShears = (state.itemsOwned['shears'] || 0) > 0;
    ensureConsumables();
    const waterCharges = state.consumables.water || 0;
    const nutrientCharges = state.consumables.nutrient || 0;
    const anyPestCharges = (state.consumables.spray||0) + (state.consumables.fungicide||0) + (state.consumables.beneficials||0);
    if(harvestBtn){
      harvestBtn.disabled = !(plant.growProg >= 1 && hasShears && plant.health > 0);
      harvestBtn.title = harvestBtn.disabled ? 'Ernte erfordert Schere und reife Pflanze' : 'Ernten';
    }
    if(waterBtn){
      if(waterCharges <= 0){
        waterBtn.disabled = true;
        waterBtn.title = 'Kein Wasserkanister – im Handel kaufen';
      }else{
        waterBtn.disabled = false;
        waterBtn.title = `Waessern (Kanister: ${waterCharges})`;
      }
    }
    if(feedBtn){
      if(nutrientCharges <= 0){
        feedBtn.disabled = true;
        feedBtn.title = 'Kein Düngerpaket – im Handel kaufen';
      }else{
        feedBtn.disabled = false;
        feedBtn.title = `Duengen (Pakete: ${nutrientCharges})`;
      }
    }
    if(pestBtn){
      const infected = !!plant.pest;
      pestBtn.disabled = !(infected && anyPestCharges > 0);
      pestBtn.title = infected ? (anyPestCharges>0 ? 'Abwehr einsetzen' : 'Keine Abwehr vorrätig') : 'Keine Schädlinge';
    }
  }

  function updateProgressBars(){
    $$('#slots .plant-card').forEach(card => {
      const slot = Number(card.dataset.slot);
      const plant = state.plants.find(p => p.slot === slot);
      if(!plant) return;
      ensurePlantDefaults(plant);
      updatePlantCard(card, plant);
    });
  }

  function spawnFloat(slotIndex, text){
    const card = $(`#slots .plant-card[data-slot="${slotIndex}"]`);
    if(!card) return;
    const fx = card.querySelector('[data-fx]');
    if(!fx) return;
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.top = '45%';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function spawnBurst(slotIndex, symbol='🍃', count=6){
    const card = $(`#slots .plant-card[data-slot="${slotIndex}"]`);
    if(!card) return;
    const fx = card.querySelector('[data-fx]');
    if(!fx) return;
    for(let i=0;i<count;i++){
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = symbol;
      p.style.left = '50%';
      p.style.top = '46%';
      const dx = (Math.random()*28 - 14).toFixed(1) + 'px';
      p.style.setProperty('--dx', dx);
      p.style.animationDelay = (i*0.03)+'s';
      fx.appendChild(p);
      setTimeout(()=> p.remove(), 1300);
    }
  }

  function renderAll(){
    renderSlots();
    renderShop();
    renderResources();
    renderUpgrades();
    renderStats();
    renderTrade();
    renderSettings();
    renderResearch();
    if(unlockCostEl) unlockCostEl.textContent = state.slotsUnlocked >= MAX_SLOTS ? 'max' : fmt(slotUnlockCost(state.slotsUnlocked));
  }

  function updateOfferTimers(){
    const now = Date.now();
    const before = state.offers.length;
    state.offers = state.offers.filter(o => o.expiresAt > now);
    if(offerListEl && state.offers.length !== before) renderOffers();
    $$('#offerList [data-offer]').forEach(el => {
      const id = Number(el.dataset.offer);
      const offer = state.offers.find(o => o.id === id);
      if(!offer){ el.textContent = 'abgelaufen'; return; }
      const sec = Math.max(0, Math.ceil((offer.expiresAt - now) / 1000));
      el.textContent = `${sec}s`;
    });
  }

  function initTabs(){
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const id = btn.dataset.tab;
        $$('.tab').forEach(tab => tab.classList.remove('active'));
        const panel = document.querySelector(`#tab-${id}`);
        if(panel) panel.classList.add('active');
        if(id === 'trade') renderTrade();
        if(id === 'settings') renderSettings();
        if(id === 'research') renderResearch();
      });
    });
  }

  function applyTheme(){
    if(state.theme === 'light') document.body.classList.add('light');
    else document.body.classList.remove('light');
  }

  function initThemeToggle(){
    if(!themeToggle) return;
    themeToggle.checked = state.theme === 'light';
    themeToggle.addEventListener('change', () => {
      state.theme = themeToggle.checked ? 'light' : 'dark';
      applyTheme();
      save();
    });
  }

  function maybeWelcome(){
    if(state.welcomeRewarded) return;
    state.cash += 100;
    state.welcomeRewarded = true;
    renderResources();
    save();
    if(welcomeModal){
      welcomeModal.hidden = false;
      welcomeModal.classList.add('show');
      if(welcomeOk){
        welcomeOk.addEventListener('click', () => {
          welcomeModal.classList.remove('show');
          welcomeModal.hidden = true;
        }, { once:true });
      }
    }
  }

  let lastTick = performance.now();
  let saveTicker = 0;

  function loop(now){
    const dt = Math.min(0.2, (now - lastTick) / 1000);
    lastTick = now;
    state.playtimeSec += dt;

    for(const plant of state.plants){
      advancePlant(plant, dt);
    }

    const perSec = computePerSec();
    if(perSec > state.bestPerSec) state.bestPerSec = perSec;

    state.nextOfferIn -= dt;
    if(state.nextOfferIn <= 0){
      if(state.offers.length < currentMaxOffers()) spawnOffer();
      const [minS, maxS] = currentSpawnWindow();
      state.nextOfferIn = minS + Math.random() * (maxS - minS);
      renderOffers();
    }

    updateOfferTimers();
    updateProgressBars();
    renderResources();

    saveTicker += dt;
    if(saveTicker > 3){
      save();
      saveTicker = 0;
    }

    requestAnimationFrame(loop);
  }

  function renderSettings(){
    const d = DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
    if(diffGrowth) diffGrowth.textContent = 'x' + (d.growth || 1).toFixed(2);
    if(diffPest) diffPest.textContent = 'x' + (d.pest || 1).toFixed(2);
    $$('.chip').forEach(el => el.classList.remove('active'));
    const cur = state.difficulty;
    if(cur === 'easy' && diffEasy) diffEasy.classList.add('active');
    if(cur === 'normal' && diffNormal) diffNormal.classList.add('active');
    if(cur === 'hard' && diffHard) diffHard.classList.add('active');
  }

  function setDifficulty(mode){
    if(!DIFFICULTIES[mode]) return;
    state.difficulty = mode;
    renderSettings();
    showToast('Schwierigkeit: ' + DIFFICULTIES[mode].name);
    save();
  }

  function bindGlobal(){
    if(unlockBtn) unlockBtn.addEventListener('click', unlockSlot);
    const prestigeBtn = $('#prestigeBtn');
    if(prestigeBtn) prestigeBtn.addEventListener('click', doPrestige);
    if(sell10Btn) sell10Btn.addEventListener('click', () => quickSell(10));
    if(sell100Btn) sell100Btn.addEventListener('click', () => quickSell(100));
    if(sellMaxBtn) sellMaxBtn.addEventListener('click', () => quickSell(Math.floor(state.grams * 0.5)));
    if(buyWaterBtn) buyWaterBtn.addEventListener('click', () => buyConsumable('water'));
    if(buyNutrientBtn) buyNutrientBtn.addEventListener('click', () => buyConsumable('nutrient'));
    if(buySprayBtn) buySprayBtn.addEventListener('click', () => buyConsumable('spray'));
    if(buyFungicideBtn) buyFungicideBtn.addEventListener('click', () => buyConsumable('fungicide'));
    if(buyBeneficialBtn) buyBeneficialBtn.addEventListener('click', () => buyConsumable('beneficial'));
    if(diffEasy) diffEasy.addEventListener('click', () => setDifficulty('easy'));
    if(diffNormal) diffNormal.addEventListener('click', () => setDifficulty('normal'));
    if(diffHard) diffHard.addEventListener('click', () => setDifficulty('hard'));
    setInterval(renderStats, 1000);
  }

  function start(){
    load();
    applyOfflineProgress();
    ensureConsumables();
    applyTheme();
    initThemeToggle();
    initTabs();
    bindGlobal();
    renderAll();
    maybeWelcome();
    renderSettings();
    requestAnimationFrame(ts => {
      lastTick = ts;
      requestAnimationFrame(loop);
    });
    window.addEventListener('beforeunload', save);
  }

  start();
})();





